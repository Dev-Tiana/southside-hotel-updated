import crypto from "node:crypto";
import path from "node:path";
import { TRPCError } from "@trpc/server";
import { cents } from "../management/domain";
import {getDb} from "../db";
import {sql} from "drizzle-orm";
import type { Attempt } from "./repository";
import {assertOwnedTestDatabase} from "./testGuard";
import {providerContext,providerFailure,providerTimedOut,type ProviderContext} from "./providerDiagnostics";
import {inspectProviderError} from './providerErrorBody';

export type VerifiedPayment={reference:string;id:string;status:string;amount:number;currency:string;domain:string;bookingReference:string;attemptReference:string};
export interface PaymentProvider{mode:"mock"|"test";initialize(attempt:Attempt,email:string,bookingReference:string):Promise<string>;verify(attempt:Attempt,bookingReference:string):Promise<VerifiedPayment>;}
export const MOCK_SIGNING_SECRET="southside-owned-local-payment-fixture-only";
export function getPaystackConfig(){
  const requested=process.env.SOUTHSIDE_PAYMENTS_MODE;
  const callbackMode=process.env.SOUTHSIDE_PAYSTACK_CALLBACK_MODE;
  if(requested==='test'&&callbackMode!==undefined&&!['return','omit'].includes(callbackMode))return{enabled:false,mode:'disabled' as const};
  if(requested==="mock"||requested==="test"){
    try{const url=new URL(process.env.DATABASE_URL??"");if(url.hostname!=="127.0.0.1"||url.port!=="3307"||!["/southside_development","/southside_integration"].includes(url.pathname)||process.env.HOST!=="127.0.0.1")return{enabled:false,mode:"disabled" as const};}catch{return{enabled:false,mode:"disabled" as const};}
  }
  if(requested==="mock"){
    let url:URL;try{url=new URL(process.env.DATABASE_URL??"");}catch{return{enabled:false,mode:"disabled" as const};}
    const owned=process.env.SOUTHSIDE_PAYMENT_MOCK==="owned-local-v1"&&url.hostname==="127.0.0.1"&&url.port==="3307"&&["/southside_development","/southside_integration"].includes(url.pathname)&&process.env.HOST==="127.0.0.1";
    return owned?{enabled:true,mode:"mock" as const}:{enabled:false,mode:"disabled" as const};
  }
  const enabled=requested==="test"&&new URL(process.env.DATABASE_URL!).pathname==="/southside_development"&&process.env.SOUTHSIDE_PAYSTACK_WEBHOOKS==="disabled"&&/^\d+$/.test(process.env.SOUTHSIDE_PHASE9_BASELINE_ID??"")&&process.env.PAYSTACK_TEST_NETWORK_APPROVED==="1"&&/^sk_test_[A-Za-z0-9]+$/.test(process.env.PAYSTACK_SECRET_KEY??"")&&/^pk_test_[A-Za-z0-9]+$/.test(process.env.PAYSTACK_PUBLIC_KEY??"");
  return enabled?{enabled:true,mode:"test" as const}:{enabled:false,mode:"disabled" as const};
}
function unavailable():never{throw new TRPCError({code:"SERVICE_UNAVAILABLE",message:"Test payments are disabled or the provider is unavailable. No live payments are supported."});}
async function mockOwnership(){const db=await getDb();const[rows]=await db.execute(sql`SELECT @@datadir AS datadir, @@port AS port, DATABASE() AS name`);const row=(rows as unknown as any[])[0];if(!row||path.resolve(row.datadir).toLowerCase()!==path.resolve(".local/mysql-data").toLowerCase()||Number(row.port)!==3307||!["southside_development","southside_integration"].includes(row.name))unavailable();}
async function request(endpoint:string,body:unknown|undefined,context:ProviderContext){
  const config=getPaystackConfig();if(!config.enabled||config.mode!=="test")providerFailure(context,"configuration","configuration_disabled");
  try{await assertOwnedTestDatabase();}catch(error){providerFailure(context,"database_guard","database_guard_failed",error);}
  const signal=AbortSignal.timeout(10000);let response:Response;
  try{response=await fetch(`https://api.paystack.co/transaction/${endpoint}`,{method:body?"POST":"GET",headers:{Authorization:`Bearer ${process.env.PAYSTACK_SECRET_KEY}`,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{}),signal,redirect:"error"});}
  catch(error){providerFailure(context,"request",providerTimedOut(error,signal)?"request_timeout":"connection_failure",error);}
  context.headersReceived=true;context.httpStatus=response.status;
  if(!response.ok){context.providerError=await inspectProviderError(response,signal);providerFailure(context,"http_response","http_error");}
  let text:string;
  try{text=await response.text();}catch(error){providerFailure(context,"response_body",providerTimedOut(error,signal)?"response_body_timeout":"response_body_failure",error);}
  if(text.length>1024*1024)providerFailure(context,"response_body","response_too_large");
  let result:any;
  try{result=JSON.parse(text,((key:string,value:unknown,source?:{source?:string})=>{if(key==="id"&&typeof value==="number"&&!Number.isSafeInteger(value)){if(!source?.source||!/^\d+$/.test(source.source)||BigInt(source.source)>18446744073709551615n)throw new RangeError("Invalid unsigned provider ID");return source.source;}return value;}) as any);}
  catch(error){providerFailure(context,"json_parsing",error instanceof SyntaxError?"json_parse_error":"json_value_error");}
  if(result?.status!==true||!result?.data)providerFailure(context,"response_validation","provider_response_error");
  return result.data;
}
export function provider():PaymentProvider{
  const config=getPaystackConfig();if(!config.enabled||config.mode==="disabled")unavailable();
  if(config.mode==="mock")return{
    mode:"mock",async initialize(a){await mockOwnership();return `/payment/mock?reference=${encodeURIComponent(a.reference)}`;},
    async verify(a,bookingReference){await mockOwnership();return{reference:a.reference,id:`mock-${a.id}`,status:a.mockOutcome,amount:Number(cents(a.amount)),currency:a.currency,domain:"test",bookingReference,attemptReference:a.reference};},
  };
  return{mode:"test",async initialize(a,email,bookingReference){
    const context=providerContext("initialize");let callbackFields:{callback_url?:string}={};
    if(process.env.SOUTHSIDE_PAYSTACK_CALLBACK_MODE!=='omit'){
      const origin=process.env.STAFF_AUTH_ORIGIN;let callback:URL;
      try{callback=new URL("/payment/return",origin);}catch{providerFailure(context,"callback_validation","callback_url_invalid");}
      if(callback.origin!==origin)providerFailure(context,"callback_validation","callback_url_invalid");
      callbackFields={callback_url:callback.href};
    }
    const data=await request("initialize",{email,amount:cents(a.amount).toString(),currency:a.currency,reference:a.reference,...callbackFields,metadata:{booking_reference:bookingReference,attempt_reference:a.reference}},context);
    if(typeof data.authorization_url!=="string"||!data.authorization_url)providerFailure(context,"checkout_validation","checkout_url_missing");
    let url:URL;try{url=new URL(data.authorization_url);}catch{providerFailure(context,"checkout_validation","checkout_url_invalid");}
    if(url.protocol!=="https:"||url.hostname!=="checkout.paystack.com"||url.username||url.password||url.port)providerFailure(context,"checkout_validation","checkout_url_rejected");
    if(data.reference!==a.reference)providerFailure(context,"reference_validation","reference_mismatch");return url.href;
  },async verify(a){
    const context=providerContext("verify"),d=await request(`verify/${encodeURIComponent(a.reference)}`,undefined,context);
    const id=typeof d.id==="string"?d.id:Number.isSafeInteger(d.id)?String(d.id):"";
    if(!/^\d+$/.test(id)||typeof d.status!=="string"||!Number.isSafeInteger(d.amount)||d.amount<0)providerFailure(context,"transaction_validation","invalid_transaction_response");
    return{reference:d.reference,id,status:d.status,amount:d.amount,currency:d.currency,domain:d.domain,bookingReference:d.metadata?.booking_reference,attemptReference:d.metadata?.attempt_reference};
  }};
}
export function verifyPaystackWebhook(rawBody:Buffer,signature:string|undefined){
  const config=getPaystackConfig();if(!config.enabled||!signature||!/^\w{128}$/.test(signature)||!/^[a-f0-9]+$/i.test(signature))return false;
  const secret=config.mode==="mock"?MOCK_SIGNING_SECRET:process.env.PAYSTACK_SECRET_KEY;
  if(!secret)return false;const expected=crypto.createHmac("sha512",secret).update(rawBody).digest();const received=Buffer.from(signature,"hex");return expected.length===received.length&&crypto.timingSafeEqual(expected,received);
}
