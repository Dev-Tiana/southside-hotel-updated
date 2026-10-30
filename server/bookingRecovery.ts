import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { bookingSubmissions,reservations } from "../drizzle/schema";
import { getDb } from "./db";
import { ServiceFailure } from "./_core/diagnostics";
export async function recoverBooking(submissionId:string){
  try{const db=await getDb();const keyHash=createHash("sha256").update(submissionId.toLowerCase()).digest("hex");const [row]=await db.select({reservationId:reservations.id,reference:reservations.reference,status:reservations.status,total:reservations.total,currency:reservations.currency,amountPaid:reservations.amountPaid,nights:reservations.nights}).from(bookingSubmissions).innerJoin(reservations,eq(bookingSubmissions.reservationId,reservations.id)).where(eq(bookingSubmissions.keyHash,keyHash));return row??null;}
  catch{throw new ServiceFailure("database_unavailable");}
}
