import path from "node:path";
import {sql} from "drizzle-orm";
import {TRPCError} from "@trpc/server";
import {getDb} from "../db";

export function assertPhase9Fixture(id:number,name:string,email:string){
  const boundary=process.env.SOUTHSIDE_PHASE9_BASELINE_ID??"";
  if(!/^\d+$/.test(boundary)||!Number.isSafeInteger(Number(boundary))||id<=Number(boundary)||!/^Phase Eight Fictional Phase Nine\b/.test(name)||!email.toLowerCase().endsWith("@example.invalid"))throw new TRPCError({code:"PRECONDITION_FAILED",message:"External test payments are restricted to newly created fictional Phase 9 bookings."});
}
export async function assertOwnedTestDatabase(){
  const db=await getDb();
  const[rows]=await db.execute(sql`SELECT @@datadir AS datadir, @@port AS port, DATABASE() AS name, VERSION() AS version`);
  const r=(rows as unknown as Array<{datadir:string;port:number;name:string;version:string}>)[0];
  if(!r||r.name!=="southside_development"||Number(r.port)!==3307||!/^8\./.test(r.version)||/mariadb/i.test(r.version)||path.resolve(r.datadir).toLowerCase()!==path.resolve(".local/mysql-data").toLowerCase())throw new TRPCError({code:"SERVICE_UNAVAILABLE",message:"The isolated development database identity could not be verified. No provider request was sent."});
}
