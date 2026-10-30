import {eq,desc,inArray} from "drizzle-orm";
import {TRPCError} from "@trpc/server";
import * as s from "../../drizzle/schema";
import {getDb} from "../db";
import {ServiceFailure} from "../_core/diagnostics";
import {assertOperationalDatabase} from "../management/compatibility";
import {createHash} from "node:crypto";
export type Attempt=typeof s.paymentAttempts.$inferSelect;
export type Reservation=typeof s.reservations.$inferSelect;
export type PaymentListRow=Pick<Attempt,"id"|"reservationId"|"reference"|"amount"|"currency"|"status"|"providerStatus"|"mode"|"lastErrorCode"|"createdAt">&{bookingReference:string;bookingStatus:Reservation["status"];total:string;amountPaid:string;outstanding:string};
export interface PaymentUnit{
  reservation:Reservation;guest:typeof s.guests.$inferSelect;attempts:Attempt[];
  insertAttempt(values:typeof s.paymentAttempts.$inferInsert):Promise<Attempt>;
  updateAttempt(id:number,values:Partial<typeof s.paymentAttempts.$inferInsert>):Promise<void>;
  event(attemptId:number,key:string,source:string,status:string,reason:string|null,details:unknown):Promise<boolean>;
  transactionOwner(id:string):Promise<number|undefined>;
  credit(attempt:Attempt,amountPaid:string,outstanding:string):Promise<void>;
  audit(action:string,details:unknown,actorId?:number):Promise<void>;
}
export interface PaymentRepository{
  capability(submissionId:string):Promise<number|undefined>;
  reference(reference:string):Promise<Attempt|undefined>;
  withReservation<T>(id:number,work:(u:PaymentUnit)=>Promise<T>):Promise<T>;
  list():Promise<{rows:PaymentListRow[];events:typeof s.paymentEvents.$inferSelect[]}>;
}
const hash=(v:string)=>createHash("sha256").update(v.toLowerCase()).digest("hex");
export const paymentRepository:PaymentRepository={
  async capability(id){try{const db=await getDb();const[row]=await db.select().from(s.bookingSubmissions).where(eq(s.bookingSubmissions.keyHash,hash(id)));return row?.reservationId;}catch{throw new ServiceFailure("database_unavailable");}},
  async reference(reference){try{const db=await getDb();const[row]=await db.select().from(s.paymentAttempts).where(eq(s.paymentAttempts.reference,reference));return row;}catch{throw new ServiceFailure("database_unavailable");}},
  async withReservation(id,work){
    try{const db=await getDb();await assertOperationalDatabase(db);const[initial]=await db.select().from(s.reservations).where(eq(s.reservations.id,id));if(!initial)throw new TRPCError({code:"NOT_FOUND",message:"Booking access could not be verified."});
      return await db.transaction(async tx=>{
        await tx.select({id:s.roomCategories.id}).from(s.roomCategories).where(eq(s.roomCategories.id,initial.roomCategoryId)).for("update");
        const[reservation]=await tx.select().from(s.reservations).where(eq(s.reservations.id,id)).for("update");
        const[guest]=await tx.select().from(s.guests).where(eq(s.guests.id,reservation.guestId));
        const attempts=await tx.select().from(s.paymentAttempts).where(eq(s.paymentAttempts.reservationId,id)).for("update");
        const unit:PaymentUnit={reservation,guest,attempts,
          async insertAttempt(values){const[result]=await tx.insert(s.paymentAttempts).values(values);const[row]=await tx.select().from(s.paymentAttempts).where(eq(s.paymentAttempts.id,Number(result.insertId)));return row;},
          async updateAttempt(attemptId,values){await tx.update(s.paymentAttempts).set(values).where(eq(s.paymentAttempts.id,attemptId));},
          async event(attemptId,eventKey,source,status,reason,details){const[existing]=await tx.select({id:s.paymentEvents.id}).from(s.paymentEvents).where(eq(s.paymentEvents.eventKey,eventKey));if(existing)return false;await tx.insert(s.paymentEvents).values({attemptId,eventKey,source,status,reason,details:JSON.stringify(details)});return true;},
          async transactionOwner(providerId){const[row]=await tx.select({id:s.paymentAttempts.id}).from(s.paymentAttempts).where(eq(s.paymentAttempts.providerTransactionId,providerId));return row?.id;},
          async credit(a,amountPaid,outstanding){await tx.insert(s.payments).values({reservationId:id,provider:a.mode==="mock"?"paystack-mock":"paystack-test",providerReference:a.reference,status:"paid",amount:a.amount,currency:a.currency,verifiedAt:new Date()});await tx.update(s.reservations).set({amountPaid,outstanding}).where(eq(s.reservations.id,id));},
          async audit(action,details,actorId){await tx.insert(s.auditLogs).values({actorId:actorId??null,actorType:actorId?"staff":"payment_service",action,entityType:"reservation_payment",entityId:String(id),details:JSON.stringify(details)});},
        };return work(unit);
      },{isolationLevel:"read committed"});
    }catch(error){if(error instanceof TRPCError||error instanceof ServiceFailure)throw error;let cause:any=error;for(let i=0;i<4&&cause;i++,cause=cause.cause)if(["ER_DUP_ENTRY","ER_LOCK_DEADLOCK","ER_LOCK_WAIT_TIMEOUT"].includes(cause.code))throw new TRPCError({code:"CONFLICT",message:"Payment processing was busy or a reference was already used. Verify the existing attempt before trying again."});throw new ServiceFailure("database_unavailable");}
  },
  async list(){try{const db=await getDb();const rows=await db.select({id:s.paymentAttempts.id,reservationId:s.paymentAttempts.reservationId,bookingReference:s.reservations.reference,bookingStatus:s.reservations.status,total:s.reservations.total,amountPaid:s.reservations.amountPaid,outstanding:s.reservations.outstanding,reference:s.paymentAttempts.reference,amount:s.paymentAttempts.amount,currency:s.paymentAttempts.currency,status:s.paymentAttempts.status,providerStatus:s.paymentAttempts.providerStatus,mode:s.paymentAttempts.mode,lastErrorCode:s.paymentAttempts.lastErrorCode,createdAt:s.paymentAttempts.createdAt}).from(s.paymentAttempts).innerJoin(s.reservations,eq(s.reservations.id,s.paymentAttempts.reservationId)).orderBy(desc(s.paymentAttempts.id)).limit(100);const events=rows.length?await db.select().from(s.paymentEvents).where(inArray(s.paymentEvents.attemptId,rows.map(r=>r.id))).orderBy(desc(s.paymentEvents.id)).limit(300):[];return{rows,events};}catch{throw new ServiceFailure("database_unavailable");}},
};
