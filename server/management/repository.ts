import { eq, inArray, sql, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import * as schema from "../../drizzle/schema";
import { getDb } from "../db";
import { ServiceFailure } from "../_core/diagnostics";
import { reject, type Repository, type Unit, type CategoryState, type Entity } from "./domain";
import { assertOperationalDatabase } from "./compatibility";

function driverCode(error: unknown): string | undefined {
  let current = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth++) {
    if ("code" in current && typeof current.code === "string") return current.code;
    current = "cause" in current ? current.cause : undefined;
  }
}

// All inventory writers acquire the same category lock before reading related
// rows. READ COMMITTED + locking reads avoids stale REPEATABLE READ snapshots.
export const mysqlRepository: Repository = {
  async withCategory(id, work) {
    try {
      const db = await getDb();
      await assertOperationalDatabase(db);
      return await db.transaction(async tx => {
        const [category] = await tx.select().from(schema.roomCategories).where(eq(schema.roomCategories.id, id)).for("update");
        if (!category) reject("Room category not found.", "NOT_FOUND");
        const [policy] = await tx.select().from(schema.inventoryPolicies).where(eq(schema.inventoryPolicies.roomCategoryId, id)).for("update");
        const reservations = await tx.select().from(schema.reservations).where(eq(schema.reservations.roomCategoryId, id)).for("update");
        const physicalRooms = await tx.select().from(schema.physicalRooms).where(eq(schema.physicalRooms.roomCategoryId, id)).for("update");
        const reservationIds = reservations.map(row => row.id), roomIds = physicalRooms.map(row => row.id);
        const guestIds = [...new Set(reservations.map(row => row.guestId))];
        const state: CategoryState = {
          category, policy, reservations, physicalRooms,
          guests: guestIds.length ? await tx.select().from(schema.guests).where(inArray(schema.guests.id, guestIds)).for("update") : [],
          reservationStatusHistory: reservationIds.length ? await tx.select().from(schema.reservationStatusHistory).where(inArray(schema.reservationStatusHistory.reservationId, reservationIds)).for("update") : [],
          bookingHolds: await tx.select().from(schema.bookingHolds).where(eq(schema.bookingHolds.roomCategoryId, id)).for("update"),
          inventoryBlocks: await tx.select().from(schema.inventoryBlocks).where(eq(schema.inventoryBlocks.roomCategoryId, id)).for("update"),
          roomRates: await tx.select().from(schema.roomRates).where(eq(schema.roomRates.roomCategoryId, id)).for("update"),
          roomAssignments: reservationIds.length ? await tx.select().from(schema.roomAssignments).where(inArray(schema.roomAssignments.reservationId, reservationIds)).for("update") : [],
          reservationAmendments: reservationIds.length ? await tx.select().from(schema.reservationAmendments).where(inArray(schema.reservationAmendments.reservationId, reservationIds)).for("update") : [],
          roomMaintenance: roomIds.length ? await tx.select().from(schema.roomMaintenance).where(inArray(schema.roomMaintenance.roomId, roomIds)).for("update") : [],
          housekeepingTasks: roomIds.length ? await tx.select().from(schema.housekeepingTasks).where(inArray(schema.housekeepingTasks.roomId, roomIds)).for("update") : [],
        };
        const unit: Unit = {
          state,
          async submission(keyHash) {
            const [row] = await tx.select().from(schema.bookingSubmissions).where(eq(schema.bookingSubmissions.keyHash, keyHash)).for("update");
            return row;
          },
          async saveSubmission(keyHash, requestHash, reservationId) {
            await tx.insert(schema.bookingSubmissions).values({ keyHash, requestHash, reservationId });
          },
          async enqueueNotifications(reservationId) {
            await tx.insert(schema.bookingNotifications).values([{ reservationId, audience: "guest", state: "disabled" }, { reservationId, audience: "administrator", state: "disabled" }]);
          },
          async categoryImages() {
            const [row] = await tx.select().from(schema.hotelSettings).where(eq(schema.hotelSettings.settingKey, `room_category_media_${id}`)).for("update");
            return row?.settingValue ? JSON.parse(row.settingValue) : [];
          },
          async saveCategory(values, images) {
            await tx.update(schema.roomCategories).set(values).where(eq(schema.roomCategories.id, id));
            if (images) await tx.insert(schema.hotelSettings).values({ settingKey: `room_category_media_${id}`, settingValue: JSON.stringify(images), verification: "confirmed" })
              .onDuplicateKeyUpdate({ set: { settingValue: JSON.stringify(images), verification: "confirmed" } });
          },
          async insert(entity, values) {
            // The typed Unit interface validates each table's insert shape.
            // Drizzle's union-table overload needs a localized adapter cast.
            const result = await tx.insert(schema[entity] as any).values(values as any);
            return Number(result[0].insertId);
          },
          async update(entity: Entity, rowId, values) {
            const table = schema[entity];
            await tx.update(table as any).set(values as any).where(eq(table.id, rowId));
          },
          async audit(action, actorId, details) {
            await tx.insert(schema.auditLogs).values({ actorId, actorType: actorId === null ? "guest" : "staff", action, entityType: "category_operations", entityId: String(id), details: JSON.stringify(details) });
          },
          async terms() {
            const [setting] = await tx.select().from(schema.hotelSettings).where(eq(schema.hotelSettings.settingKey, "approved_booking_terms")).for("update");
            if (!setting?.settingValue || setting.verification !== "confirmed") reject("Booking terms await hotel approval.", "PRECONDITION_FAILED");
            return setting.settingValue;
          },
          async approveTerms(terms, actorId) {
            await tx.insert(schema.hotelSettings).values({ settingKey: "approved_booking_terms", settingValue: terms, verification: "confirmed", updatedBy: actorId })
              .onDuplicateKeyUpdate({ set: { settingValue: terms, verification: "confirmed", updatedBy: actorId } });
          },
          async staffExists(staffId) {
            return (await tx.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, staffId))).length === 1;
          },
        };
        return work(unit);
      }, { isolationLevel: "read committed", accessMode: "read write" });
    } catch (error) {
      if (error instanceof TRPCError || error instanceof ServiceFailure) throw error;
      if (driverCode(error) === "ER_DUP_ENTRY") reject("A record with that unique value already exists.");
      if (["ER_LOCK_DEADLOCK", "ER_LOCK_WAIT_TIMEOUT"].includes(driverCode(error) ?? "")) reject("The inventory was busy. Reload and try again.");
      // Includes failed audit writes: the whole transaction rolls back.
      throw new ServiceFailure("database_unavailable");
    }
  },
  async categoryIds(slug) {
    try {
      const db = await getDb();
      return (await db.select({ id: schema.roomCategories.id }).from(schema.roomCategories).where(slug ? eq(schema.roomCategories.slug, slug) : sql`1 = 1`)).map(row => row.id);
    } catch { throw new ServiceFailure("database_unavailable"); }
  },
  async history(categoryId) {
    try {
      const db = await getDb();
      return await db.select().from(schema.auditLogs).where(sql`${schema.auditLogs.entityType} = 'category_operations' AND ${schema.auditLogs.entityId} = ${String(categoryId)}`).orderBy(desc(schema.auditLogs.id)).limit(200);
    } catch { throw new ServiceFailure("database_unavailable"); }
  },
};
