import { desc, eq } from "drizzle-orm";
import { bookingNotifications, guests, reservations } from "../drizzle/schema";
import { getDb } from "./db";
import { ServiceFailure } from "./_core/diagnostics";

// No provider is authorized or implemented in Phase 7. Environment flags alone
// cannot start delivery. A later reviewed adapter must supply verified sender,
// recipients, retries and provider idempotency before enabling a worker.
export const notificationDelivery = Object.freeze({ enabled: false, reason: "Email provider and sender identity await authorization." });
export function renderBookingNotification(row: { reference: string; status: string; total: string; currency: string; amountPaid: string }, audience: "guest" | "administrator") {
  const pending = row.status === "pending manual confirmation";
  const subject = `${audience === "guest" ? "Reservation acknowledgement" : "New hotel reservation"}: ${row.reference}`.replace(/[\r\n]/g, " ");
  return { subject, text: `Reference: ${row.reference}\nCurrent saved status: ${row.status}\nTotal: ${row.currency} ${row.total}\nAmount paid: ${row.currency} ${row.amountPaid}\n${pending ? "Your request is pending hotel review. This is not a confirmed stay." : "This message reports the current saved status; contact the hotel with questions."}` };
}
export async function listBookingNotifications() {
  try {
    const db = await getDb();
    const rows = await db.select({ notification: bookingNotifications, reservation: reservations, guestEmail: guests.email })
      .from(bookingNotifications).innerJoin(reservations, eq(reservations.id, bookingNotifications.reservationId)).innerJoin(guests, eq(guests.id, reservations.guestId))
      .orderBy(desc(bookingNotifications.id)).limit(50);
    return { delivery: notificationDelivery, rows: rows.map(row => ({ id: row.notification.id, reference: row.reservation.reference, audience: row.notification.audience, state: row.notification.state, attempts: row.notification.attempts, reservationStatus: row.reservation.status,
      recipient: row.notification.audience === "guest" ? row.guestEmail : "Administrator recipient not configured", ...renderBookingNotification(row.reservation, row.notification.audience) })) };
  } catch { throw new ServiceFailure("database_unavailable"); }
}
