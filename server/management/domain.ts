import { TRPCError } from "@trpc/server";
import { createHash } from "node:crypto";
import { dateKey, hotelToday, stayDates } from "../../shared/operations";
import type * as schema from "../../drizzle/schema";

export type Entity = "physicalRooms" | "inventoryPolicies" | "roomAssignments" | "housekeepingTasks" | "roomMaintenance" | "reservationAmendments" | "reservations" | "bookingHolds" | "inventoryBlocks" | "roomRates" | "guests" | "reservationStatusHistory";
export type Row<K extends Entity> = (typeof schema)[K]["$inferSelect"];
export type Insert<K extends Entity> = (typeof schema)[K]["$inferInsert"];
export type CategoryState = {
  category: typeof schema.roomCategories.$inferSelect;
  policy?: Row<"inventoryPolicies">;
} & { [K in Exclude<Entity, "inventoryPolicies">]: Row<K>[] };
export interface Unit {
  state: CategoryState;
  categoryImages(): Promise<import("../../shared/categories").CategoryDetails["images"]>;
  saveCategory(values: Partial<typeof schema.roomCategories.$inferInsert>, images?: import("../../shared/categories").CategoryDetails["images"]): Promise<void>;
  insert<K extends Entity>(entity: K, values: Insert<K>): Promise<number>;
  update<K extends Entity>(entity: K, id: number, values: Partial<Insert<K>>): Promise<void>;
  audit(action: string, actorId: number | null, details: unknown): Promise<void>;
  terms(): Promise<string>;
  approveTerms(terms: string, actorId: number): Promise<void>;
  staffExists(id: number): Promise<boolean>;
  submission(keyHash: string): Promise<{ requestHash: string; reservationId: number } | undefined>;
  saveSubmission(keyHash: string, requestHash: string, reservationId: number): Promise<void>;
  enqueueNotifications(reservationId: number): Promise<void>;
}
export interface Repository {
  withCategory<T>(id: number, work: (unit: Unit) => Promise<T>): Promise<T>;
  categoryIds(slug?: string): Promise<number[]>;
  history(categoryId: number): Promise<unknown[]>;
}
export function reject(message: string, code: "BAD_REQUEST" | "CONFLICT" | "PRECONDITION_FAILED" | "NOT_FOUND" = "CONFLICT"): never {
  throw new TRPCError({ code, message });
}
export const consumingStatuses = new Set(["pending manual confirmation", "pending payment", "confirmed", "checked in", "cancellation requested"]);
export function reservationRevision(row: Row<"reservations">) {
  return createHash("sha256").update(JSON.stringify(Object.fromEntries(Object.entries(row).sort(([a], [b]) => a.localeCompare(b))))).digest("hex");
}
export function overlaps(a: string, b: string, c: string, d: string) { return a < d && c < b; }
function assertCurrentStays(state: CategoryState, now: Date) {
  if (state.reservations.some(row => row.status === "checked in" && dateKey(row.checkOut) <= hotelToday(now))) reject("A checked-in stay has passed its departure date. Staff must review it before allocating more inventory.");
}
export function requireReady(state: CategoryState, now = new Date()) {
  if (!state.policy) reject("Online inventory is awaiting staff reconciliation. Please contact the hotel.", "PRECONDITION_FAILED");
  assertCurrentStays(state, now);
}
export function capacity(state: CategoryState): number {
  if (state.policy?.capacitySource === "physical") {
    const count = state.physicalRooms.filter(room => room.isActive).length;
    if (count !== state.policy.reconciledCapacity) reject("Physical inventory changed. Reconcile capacity before continuing.");
    return count;
  }
  return state.category.sellableInventory;
}
export function validateStay(checkIn: string, checkOut: string, now: Date) {
  let dates: string[];
  try { dates = stayDates(checkIn, checkOut); } catch { reject("Choose valid dates for a stay between 1 and 365 nights.", "BAD_REQUEST"); }
  if (checkIn < hotelToday(now)) reject("Please choose a future check in date.", "BAD_REQUEST");
  return dates;
}
export function usage(state: CategoryState, now: Date, excludeReservation?: number, excludeHold?: string) {
  assertCurrentStays(state, now);
  const entries = [
    ...state.reservations.filter(row => consumingStatuses.has(row.status) && row.id !== excludeReservation)
      .map(row => ({ start: dateKey(row.checkIn), end: dateKey(row.checkOut), quantity: row.rooms })),
    ...state.bookingHolds.filter(row => row.status === "active" && new Date(row.expiresAt) > now && row.token !== excludeHold)
      .map(row => ({ start: dateKey(row.checkIn), end: dateKey(row.checkOut), quantity: row.rooms })),
    ...state.inventoryBlocks.filter(row => !row.releasedAt)
      .map(row => ({ start: dateKey(row.startDate), end: dateKey(row.endDate), quantity: row.quantity })),
  ];
  for (const entry of entries) {
    if (!Number.isInteger(entry.quantity) || entry.quantity < 1 || entry.start >= entry.end) reject("Existing inventory records need review before this operation.");
  }
  return entries;
}
export function available(state: CategoryState, start: string, end: string, now: Date, excludeReservation?: number, excludeHold?: string) {
  const entries = usage(state, now, excludeReservation, excludeHold);
  const events = new Map<string, number>();
  for (const entry of entries) {
    if (!overlaps(start, end, entry.start, entry.end)) continue;
    const entryStart = entry.start < start ? start : entry.start;
    events.set(entryStart, (events.get(entryStart) ?? 0) + entry.quantity);
    if (entry.end < end) events.set(entry.end, (events.get(entry.end) ?? 0) - entry.quantity);
  }
  let current = 0, peak = 0;
  for (const [, delta] of [...events].sort(([a], [b]) => a.localeCompare(b))) { current += delta; peak = Math.max(peak, current); }
  return capacity(state) - peak;
}
export function peakUsage(state: CategoryState, now: Date) {
  const today = hotelToday(now);
  const events = new Map<string, number>();
  for (const entry of usage(state, now)) {
    if (entry.end <= today) continue;
    const start = entry.start < today ? today : entry.start;
    events.set(start, (events.get(start) ?? 0) + entry.quantity);
    events.set(entry.end, (events.get(entry.end) ?? 0) - entry.quantity);
  }
  let current = 0, peak = 0;
  for (const [, delta] of [...events].sort(([a], [b]) => a.localeCompare(b))) { current += delta; peak = Math.max(peak, current); }
  return peak;
}
export function cents(value: string): bigint {
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(value)) reject("Enter a valid money amount.", "BAD_REQUEST");
  const [whole, fraction = ""] = value.split(".");
  const result = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (result > 999999999999n) reject("Amount exceeds the supported limit.", "BAD_REQUEST");
  return result;
}
export function money(value: bigint) { return `${value / 100n}.${String(value % 100n).padStart(2, "0")}`; }
export function quote(state: CategoryState, checkIn: string, checkOut: string, rooms: number) {
  const nightly = stayDates(checkIn, checkOut).map(day => {
    const rates = state.roomRates.filter(rate => rate.isActive);
    const dated = rates.filter(rate => rate.rateDate && dateKey(rate.rateDate) === day);
    const candidates = dated.length ? dated : rates.filter(rate => rate.rateDate === null);
    if (candidates.length !== 1) reject("Rates are missing or ambiguous. Ask staff to review the rate calendar.", "PRECONDITION_FAILED");
    const rate = candidates[0];
    if (rate.currency !== "NGN" || cents(rate.amount) <= 0n) reject("A valid NGN rate is required.", "PRECONDITION_FAILED");
    return { date: day, rateId: rate.id, amount: money(cents(rate.amount)) };
  });
  const total = nightly.reduce((sum, rate) => sum + cents(rate.amount) * BigInt(rooms), 0n);
  if (total > 999999999999n) reject("Amount exceeds the supported limit.", "BAD_REQUEST");
  const formatted = money(total);
  return { subtotal: formatted, tax: "0.00", total: formatted, currency: "NGN", nights: nightly.length, rateSnapshot: JSON.stringify({ currency: "NGN", rooms, nightly, tax: "0.00" }) };
}
export function findRow<K extends Exclude<Entity, "inventoryPolicies" | "guests" | "reservationStatusHistory">>(state: CategoryState, key: K, id: number): Row<K> {
  const row = state[key].find(row => row.id === id);
  if (!row) reject("The selected record was not found in this category.", "NOT_FOUND");
  return row as Row<K>;
}
export function assertRoomFree(state: CategoryState, roomId: number, checkIn: string, checkOut: string, exceptReservation?: number) {
  const room = findRow(state, "physicalRooms", roomId);
  if (!room.isActive) reject("The physical room is inactive.");
  for (const assignment of state.roomAssignments.filter(row => !row.releasedAt && row.roomId === roomId && row.reservationId !== exceptReservation)) {
    const reservation = findRow(state, "reservations", assignment.reservationId);
    if (consumingStatuses.has(reservation.status) && overlaps(checkIn, checkOut, dateKey(reservation.checkIn), dateKey(reservation.checkOut))) reject("This physical room already has an overlapping assignment.");
  }
  for (const maintenance of state.roomMaintenance.filter(row => row.roomId === roomId)) {
    const block = findRow(state, "inventoryBlocks", maintenance.inventoryBlockId);
    if (!block.releasedAt && overlaps(checkIn, checkOut, dateKey(block.startDate), dateKey(block.endDate))) reject("This room is blocked for maintenance during the stay.");
  }
  return room;
}
