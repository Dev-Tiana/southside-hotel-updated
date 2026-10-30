import { hotelToday } from "../shared/operations";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, User, contactSubmissions, reservations, roomCategories, users } from "../drizzle/schema";
import { ServiceFailure } from "./_core/diagnostics";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _db = drizzle(process.env.DATABASE_URL); }
    catch { throw new ServiceFailure("database_unavailable"); }
  }
  if (!_db) throw new ServiceFailure("database_unavailable");
  return _db;
}

async function upsertUserImpl(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) { values[field] = user[field] ?? null; updateSet[field] = user[field] ?? null; }
  }
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = values.role; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

async function getUserByOpenIdImpl(openId: string): Promise<User | undefined> {
  const db = await getDb();
  const rows = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return rows[0];
}

async function listRoomCategoriesImpl() {
  const db = await getDb();
  return db.select().from(roomCategories).where(eq(roomCategories.isActive, true)).orderBy(roomCategories.id);
}

async function listRoomDraftsImpl() {
  const db = await getDb();
  return db.select().from(roomCategories).orderBy(roomCategories.id);
}

async function searchAvailabilityImpl(input: { checkIn: string; checkOut: string; adults: number; children: number; rooms: number; roomSlug?: string }) {
  const { hotelManagement } = await import("./management/service");
  return hotelManagement.search(input);
}

async function createReservationImpl(input: import("../shared/operations").NewReservation) {
  const { hotelManagement } = await import("./management/service");
  return hotelManagement.createPublic(input);
}

function toDate(value: string) { return new Date(`${value}T00:00:00.000Z`); }

async function createContactSubmissionImpl(input: { name: string; email: string; phone?: string; enquiryType: string; message: string; }) {
  const db = await getDb();
  const result = await db.insert(contactSubmissions).values(input);
  return { id: Number(result[0].insertId) };
}

async function getAdminSummaryImpl() {
  const db = await getDb();
  const today = toDate(hotelToday());
  const [arrivals, departures, pending, confirmed, categories, recent] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(reservations).where(and(eq(reservations.checkIn, today), or(eq(reservations.status, "confirmed"), eq(reservations.status, "pending manual confirmation")))),
    db.select({ count: sql<number>`count(*)` }).from(reservations).where(and(eq(reservations.checkOut, today), or(eq(reservations.status, "confirmed"), eq(reservations.status, "checked in")))),
    db.select({ count: sql<number>`count(*)` }).from(reservations).where(or(eq(reservations.status, "pending manual confirmation"), eq(reservations.status, "pending payment"))),
    db.select({ count: sql<number>`count(*)` }).from(reservations).where(eq(reservations.status, "confirmed")),
    db.select({ count: sql<number>`count(*)` }).from(roomCategories).where(eq(roomCategories.isActive, true)),
    db.select({ reference: reservations.reference, checkIn: reservations.checkIn, checkOut: reservations.checkOut, status: reservations.status, total: reservations.total, createdAt: reservations.createdAt }).from(reservations).orderBy(desc(reservations.createdAt)).limit(10),
  ]);
  return { configured: true, arrivals: Number(arrivals[0]?.count ?? 0), departures: Number(departures[0]?.count ?? 0), pending: Number(pending[0]?.count ?? 0), confirmed: Number(confirmed[0]?.count ?? 0), categories: Number(categories[0]?.count ?? 0), reservations: recent };
}

export const upsertUser = databaseOperation(upsertUserImpl);

export const getUserByOpenId = databaseOperation(getUserByOpenIdImpl);

export const listRoomCategories = databaseOperation(listRoomCategoriesImpl);
export const listRoomDrafts = databaseOperation(listRoomDraftsImpl);

export const searchAvailability = databaseOperation(searchAvailabilityImpl);

export const createReservation = databaseOperation(createReservationImpl);

export const createContactSubmission = databaseOperation(createContactSubmissionImpl);

export const getAdminSummary = databaseOperation(getAdminSummaryImpl);

function databaseOperation<A extends unknown[], R>(operation: (...args: A) => Promise<R>) {
  return async (...args: A): Promise<R> => {
    try { return await operation(...args); }
    catch (error) {
      if (error instanceof ServiceFailure || error instanceof TRPCError) throw error;
      // Preserve only known business validation errors; driver errors may wrap
      // their SQL metadata in a cause and must never reach clients.
      if (error instanceof Error && [
        "User openId is required for upsert",
        "Room category is not configured for online booking",
        "The selected inventory changed. Search again before submitting.",
      ].includes(error.message)) throw error;
      throw new ServiceFailure("database_unavailable");
    }
  };
}

export async function checkDatabaseReadiness(): Promise<boolean> {
  try {
    const db = await getDb();
    const { assertOperationalDatabase } = await import("./management/compatibility");
    await assertOperationalDatabase(db);
    // Probe all mapped tables/columns without reading guest records.
    const schema = await import("../drizzle/schema");
    for (const table of [schema.users, schema.roomCategories, schema.roomRates,
      schema.inventoryBlocks, schema.guests, schema.reservations,
      schema.reservationStatusHistory, schema.bookingHolds, schema.payments,
      schema.contactSubmissions, schema.mediaAssets, schema.hotelSettings, schema.auditLogs,
      schema.physicalRooms, schema.inventoryPolicies, schema.roomAssignments, schema.housekeepingTasks, schema.roomMaintenance, schema.reservationAmendments,
      schema.staffCredentials, schema.staffSessions, schema.staffAuthLimits, schema.staffAuthSetup, schema.bookingSubmissions, schema.bookingNotifications,schema.paymentAttempts,schema.paymentEvents]) {
      await db.select().from(table).limit(0);
    }
    return true;
  } catch { return false; }
}
