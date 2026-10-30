import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { categoryCreate, categoryInventory, categorySave, type CategoryDetails } from "../../shared/categories";
import { auditLogs, hotelSettings, roomCategories,mediaAssets } from "../../drizzle/schema";
import {readPublicMedia} from '../media/placementRepository';
import {publishedAsset} from '../media/placements';
import { getDb } from "../db";
import { ServiceFailure } from "../_core/diagnostics";
import { assertOperationalDatabase } from "./compatibility";
import { consumingStatuses, peakUsage, reject, type CategoryState, type Repository } from "./domain";
import { hotelToday, dateKey } from "../../shared/operations";
import { mysqlRepository } from "./repository";

export function categoryRevision(category: CategoryState["category"], images: CategoryDetails["images"]) {
  return createHash("sha256").update(JSON.stringify({ category, images })).digest("hex");
}
export function assertCategoryOccupancy(state: CategoryState, occupancy: number, now = new Date()) {
  if (state.reservations.some(r => consumingStatuses.has(r.status) && (r.status === "checked in" || dateKey(r.checkOut) > hotelToday(now)) && r.adults + r.children > occupancy * r.rooms))
    reject("Occupancy would conflict with an existing reservation. Keep its committed occupancy.");
}
export function categoryAdministration(repository: Repository = mysqlRepository, clock = () => new Date()) {
  return {
    detail(categoryId: number) {
      return repository.withCategory(categoryId, async unit => {
        const images = await unit.categoryImages();
        return { ...unit.state.category, images, revision: categoryRevision(unit.state.category, images) };
      });
    },
    save(raw: Parameters<typeof categorySave.parse>[0], actorId: number) {
      const input = categorySave.parse(raw);
      return repository.withCategory(input.categoryId, async unit => {
        const before = unit.state.category, images = await unit.categoryImages();
        if (input.expectedRevision !== categoryRevision(before, images)) reject("Category changed. Reload before saving.");
        assertCategoryOccupancy(unit.state, input.maxOccupancy, clock());
        const { categoryId, expectedRevision, reason, images: nextImages, ...values } = input;
        const after = { ...values, amenities: JSON.stringify(values.amenities) };
        await unit.saveCategory(after, nextImages);
        await unit.audit("category.update", actorId, { reason, before: { ...before, images }, after: { ...after, images: nextImages } });
        return { message: "Category saved. Existing reservation snapshots are unchanged." };
      });
    },
    inventory(raw: Parameters<typeof categoryInventory.parse>[0], actorId: number) {
      const input = categoryInventory.parse(raw);
      return repository.withCategory(input.categoryId, async unit => {
        const s = unit.state, images = await unit.categoryImages();
        if (input.expectedRevision !== categoryRevision(s.category, images)) reject("Category changed. Reload before reconciling.");
        if (s.policy?.capacitySource === "physical") reject("Physical counts are authoritative. Use the existing inventory reconciliation controls before editing category capacity.");
        const actual = s.reservations.filter(r => r.status === "cancellation requested").map(r => r.id).sort((a,b) => a-b);
        if (JSON.stringify(actual) !== JSON.stringify([...new Set(input.reviewedCancellationIds)].sort((a,b) => a-b))) reject("Review every current cancellation request before reconciliation.");
        const peak = peakUsage(s, clock());
        if (input.sellableInventory < peak) reject("Capacity would be below reservations, active holds or maintenance commitments.");
        const policy = { roomCategoryId: input.categoryId, capacitySource: "category" as const, reconciledCapacity: input.sellableInventory, cancellationReconciledAt: clock(), reconciledBy: actorId, reason: input.reason };
        await unit.saveCategory({ sellableInventory: input.sellableInventory });
        if (s.policy) await unit.update("inventoryPolicies", s.policy.id, policy); else await unit.insert("inventoryPolicies", policy);
        await unit.audit("category.inventory", actorId, { reason: input.reason, before: s.category.sellableInventory, after: input.sellableInventory, peakCommitments: peak, reviewedCancellationIds: actual });
        return { message: "Category inventory reconciled and saved." };
      });
    },
  };
}

export async function createCategory(raw: Parameters<typeof categoryCreate.parse>[0], actorId: number) {
  const input = categoryCreate.parse(raw);
  try {
    const db = await getDb(); await assertOperationalDatabase(db);
    return await db.transaction(async tx => {
      const { images, reason, ...details } = input;
      const [result] = await tx.insert(roomCategories).values({ ...details, amenities: JSON.stringify(details.amenities), isActive: false, sellableInventory: 0 });
      const id = Number(result.insertId);
      await tx.insert(hotelSettings).values({ settingKey: `room_category_media_${id}`, settingValue: JSON.stringify(images), verification: "confirmed", updatedBy: actorId });
      await tx.insert(auditLogs).values({ actorId, actorType: "staff", action: "category.create", entityType: "category_operations", entityId: String(id), details: JSON.stringify({ reason, after: details, images, isActive: false, sellableInventory: 0 }) });
      return { id, message: "Category created inactive with zero inventory. Set a rate and reconcile inventory before opening bookings." };
    });
  } catch (error) {
    if (error instanceof TRPCError || error instanceof ServiceFailure) throw error;
    let cause: any = error;
    for (let i=0; i<4 && cause; i++, cause=cause.cause) if (cause.code === "ER_DUP_ENTRY") reject("That category URL already exists. Choose a unique slug.");
    throw new ServiceFailure("database_unavailable");
  }
}
export const categories = categoryAdministration();

export async function publicCategoryMedia(id: number) {
  try {
    const placements=await readPublicMedia();const override=placements[`category:${id}`];
    if(override)return override.filter(item=>item.kind==='image').map(item=>({url:item.url,alt:item.alt}));
    const db = await getDb();
    const [row] = await db.select().from(hotelSettings).where(eq(hotelSettings.settingKey, `room_category_media_${id}`));
    const images=row?.settingValue ? JSON.parse(row.settingValue) as CategoryDetails["images"] : [];
    const assets=await db.select().from(mediaAssets);
    const allowed=new Set(assets.flatMap(asset=>{const media=publishedAsset(asset);return media?.kind==='image'?[media.url]:[];}));
    return images.filter(image=>image.url.startsWith('/manus-storage/')||allowed.has(image.url));
  } catch { throw new ServiceFailure("database_unavailable"); }
}

export async function publicBookingTerms() {
  try {
    const db = await getDb();
    const [row] = await db.select().from(hotelSettings).where(eq(hotelSettings.settingKey, "approved_booking_terms"));
    return row?.verification === "confirmed" && row.settingValue ? { available: true, text: row.settingValue } : { available: false, text: "Booking terms await hotel approval. Please contact the hotel." };
  } catch { throw new ServiceFailure("database_unavailable"); }
}
