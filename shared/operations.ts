import { z } from "zod";
import { isReservationDate } from "./reservationDate";

export const hotelDate = z.string().refine(isReservationDate, "Choose a valid calendar date.");
const id = z.number().int().positive();
const reason = z.string().trim().min(5).max(2000);
const category = { categoryId: id };
export const reservationStatuses = ["draft", "pending payment", "pending manual confirmation", "confirmed", "checked in", "checked out", "cancellation requested", "cancelled", "expired", "payment failed"] as const;
export const stayInput = z.object({
  checkIn: hotelDate, checkOut: hotelDate,
  rooms: z.number().int().min(1).max(20), adults: z.number().int().min(1).max(100), children: z.number().int().min(0).max(100),
});
export const newReservationInput = stayInput.extend({
  name: z.string().trim().min(2).max(160), email: z.string().email().max(320), phone: z.string().trim().min(7).max(40),
  roomCategoryId: id, holdToken: z.string().min(10).max(48).optional(),
  expectedTotal: z.string().regex(/^\d{1,10}\.\d{2}$/).optional(),
  expectedTerms: z.string().min(10).max(20000).optional(),
  submissionId: z.string().uuid().optional(),
});
export const operationInput = z.discriminatedUnion("action", [
  z.object({ ...category, action: z.literal("room.create"), label: z.string().trim().min(1).max(80), isActive: z.boolean() }),
  z.object({ ...category, action: z.literal("room.active"), roomId: id, isActive: z.boolean(), reason }),
  z.object({ ...category, action: z.literal("room.assign"), roomId: id, reservationId: id, reason }),
  z.object({ ...category, action: z.literal("room.release"), assignmentId: id, reason }),
  z.object({ ...category, action: z.literal("rate.set"), rateDate: hotelDate.nullable(), amount: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/), reason }),
  z.object({ ...category, action: z.literal("housekeeping.create"), roomId: id, assignedTo: id.optional(), reason }),
  z.object({ ...category, action: z.literal("housekeeping.advance"), taskId: id, status: z.enum(["in progress", "completed", "inspected"]), reason }),
  z.object({ ...category, action: z.literal("maintenance.create"), roomId: id, startDate: hotelDate, endDate: hotelDate, reason: reason.max(255) }),
  z.object({ ...category, action: z.literal("maintenance.release"), maintenanceId: id, reason }),
  z.object({ ...category, action: z.literal("maintenance.releaseBlock"), blockId: id, reason }),
  newReservationInput.omit({ roomCategoryId: true }).extend({ ...category, action: z.literal("reservation.create"), source: z.enum(["staff", "walk in", "telephone", "whatsapp"]), reason }),
  z.object({ ...category, action: z.literal("reservation.status"), reservationId: id, expectedStatus: z.enum(reservationStatuses), status: z.enum(reservationStatuses), reason }),
  stayInput.extend({ ...category, action: z.literal("reservation.amend"), reservationId: id, expectedRevision: z.string().regex(/^[a-f0-9]{64}$/), reason }),
  z.object({ ...category, action: z.literal("inventory.reconcile"), capacitySource: z.enum(["category", "physical"]), reviewedCancellationIds: z.array(id).max(10000), reason }),
  z.object({ ...category, action: z.literal("hold.create"), checkIn: hotelDate, checkOut: hotelDate, rooms: z.number().int().min(1).max(20), minutes: z.number().int().min(1).max(30), reason }),
  z.object({ ...category, action: z.literal("hold.release"), holdId: id, reason }),
  z.object({ ...category, action: z.literal("terms.approve"), terms: z.string().trim().min(10).max(20000), reason }),
]);
export type Operation = z.infer<typeof operationInput>;
export type NewReservation = z.infer<typeof newReservationInput>;

export function dateKey(value: Date | string): string {
  return typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}
export function hotelToday(now = new Date()) {
  // Africa/Lagos is UTC+1 year-round. Dates remain date-only, not local timestamps.
  return new Date(now.getTime() + 3600000).toISOString().slice(0, 10);
}
export function stayDates(checkIn: string, checkOut: string): string[] {
  hotelDate.parse(checkIn); hotelDate.parse(checkOut);
  const count = (Date.parse(checkOut) - Date.parse(checkIn)) / 86400000;
  if (count <= 0 || count > 365) throw new Error("Choose a stay between 1 and 365 nights.");
  return Array.from({ length: count }, (_, index) => new Date(Date.parse(checkIn) + index * 86400000).toISOString().slice(0, 10));
}
