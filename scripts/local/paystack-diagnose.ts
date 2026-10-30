// Standalone, read-only diagnostic. Never imports/calls paymentService or any
// initializer, never applies verification, and never prints raw errors/bodies.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {connectLocal,readConfig,databaseUrl,schemas,local} from "./common.mjs";
import {provider,getPaystackConfig} from "../../server/payments/paystack";
import {assertPhase9Fixture} from "../../server/payments/testGuard";

const reference="SST-00000000000040008000000000000009",bookingReference="SSFICTIONAL09";
const file=path.join(local,"phase9-verification-diagnostic.json");
const originalFetch=globalThis.fetch;
const safeCodes=new Set(["ENOTFOUND","EAI_AGAIN","ECONNREFUSED","ECONNRESET","ETIMEDOUT","UND_ERR_CONNECT_TIMEOUT","UND_ERR_HEADERS_TIMEOUT","UND_ERR_BODY_TIMEOUT","CERT_HAS_EXPIRED","UNABLE_TO_GET_ISSUER_CERT_LOCALLY","UNABLE_TO_VERIFY_LEAF_SIGNATURE","ERR_TLS_CERT_ALTNAME_INVALID","DEPTH_ZERO_SELF_SIGNED_CERT"]);
function failure(error:any){return{kind:error?.name==="TimeoutError"?"timeout":"request_unavailable",codes:[error?.code,error?.cause?.code,...(error?.cause?.errors??[]).map((e:any)=>e?.code)].filter(code=>safeCodes.has(code))};}
async function main(){
  assert.ok(!fs.existsSync(file),"A saved diagnostic already exists. Review it instead of repeating the request.");
  assert.match(process.env.PAYSTACK_SECRET_KEY??"",/^sk_test_[A-Za-z0-9]+$/);assert.match(process.env.PAYSTACK_PUBLIC_KEY??"",/^pk_test_[A-Za-z0-9]+$/);
  const scope=JSON.parse(fs.readFileSync(path.join(local,"phase9-payment-scope.json"),"utf8"));
  assert.equal(scope.marker,"phase9-new-fictional-payments-v1");assert.equal(scope.schema,"southside_development");assert.ok(Number.isSafeInteger(scope.minimumReservationId));
  Object.assign(process.env,{DATABASE_URL:databaseUrl(readConfig(),schemas[0]),HOST:"127.0.0.1",SOUTHSIDE_PAYMENTS_MODE:"test",PAYSTACK_TEST_NETWORK_APPROVED:"1",SOUTHSIDE_PHASE9_BASELINE_ID:String(scope.minimumReservationId),SOUTHSIDE_PAYSTACK_WEBHOOKS:"disabled",STAFF_AUTH_ORIGIN:"http://127.0.0.1:3001"});
  assert.deepEqual(getPaystackConfig(),{enabled:true,mode:"test"});
  const c=await connectLocal(schemas[0],"app");await c.query("SET SESSION TRANSACTION READ ONLY");
  const result:any={bookingReference,reference,readOnly:true,initializationRetried:false,requestCount:0};
  try{
    const read=async()=>{
      const[r]:any=await c.execute("SELECT * FROM reservations WHERE reference=?",[bookingReference]);assert.equal(r.length,1);assert.equal(r[0].id,8);
      const[g]:any=await c.execute("SELECT name,email FROM guests WHERE id=?",[r[0].guestId]);assertPhase9Fixture(r[0].id,g[0].name,g[0].email);
      const[a]:any=await c.execute("SELECT * FROM payment_attempts WHERE reference=? AND reservationId=?",[reference,r[0].id]);assert.equal(a.length,1);assert.equal(a[0].mode,"test");
      const[p]:any=await c.execute("SELECT * FROM payments WHERE reservationId=?",[r[0].id]);
      const[e]:any=await c.execute("SELECT * FROM payment_events WHERE attemptId=? ORDER BY id",[a[0].id]);
      return{reservation:r[0],attempt:a[0],payments:p,events:e};
    };
    const before=await read();
    globalThis.fetch=async(input,options)=>{
      assert.equal(String(input),`https://api.paystack.co/transaction/verify/${reference}`);assert.equal(options?.method,"GET");assert.equal(options?.redirect,"error");assert.ok(!options?.body);assert.equal(++result.requestCount,1);
      const started=Date.now();
      try{
        const response=await originalFetch(input,options);result.httpStatus=response.status;
        try{
          const text=await response.clone().text();assert.ok(text.length<=1024*1024);const json=JSON.parse(text);
          result.providerEnvelopeStatus=typeof json.status==="boolean"?json.status:null;
          const message=typeof json.message==="string"?json.message:"";
          result.responseCategory=/^transaction reference not found[.!]?$/i.test(message)?"transaction_reference_not_found":response.status===401?"authentication_rejected":response.status===403?"access_rejected":response.status===429?"rate_limited":response.ok?"response_received":"http_rejection";
        }catch{result.responseCategory="response_unparseable";}
        return response;
      }catch(error){result.network=failure(error);throw error;}
      finally{result.elapsedMs=Date.now()-started;}
    };
    try{
      const value=await provider().verify(before.attempt,bookingReference);
      result.authoritative={transactionFound:true,referenceMatches:value.reference===reference,domainTest:value.domain==="test",amountMatches:value.amount===Number(before.attempt.amount)*100,currencyMatches:value.currency===before.attempt.currency,bookingBindingMatches:value.bookingReference===bookingReference,attemptBindingMatches:value.attemptReference===reference,status:["success","pending","ongoing","processing","queued","abandoned","failed","reversed"].includes(value.status)?value.status:"unrecognized",providerId:/^\d+$/.test(value.id)?value.id:null};
    }catch{result.authoritative={transactionFound:null,status:"unestablished"};}
    finally{globalThis.fetch=originalFetch;}
    const after=await read();assert.deepEqual(after,before,"Read-only diagnostic observed concurrent local changes; preserve evidence and stop.");
    result.localUnchanged=true;result.local={bookingStatus:after.reservation.status,total:after.reservation.total,amountPaid:after.reservation.amountPaid,outstanding:after.reservation.outstanding,attemptStatus:after.attempt.status,errorCode:after.attempt.lastErrorCode,paymentRows:after.payments.length};
    fs.writeFileSync(file,JSON.stringify(result,null,2),{flag:"wx"});console.log(JSON.stringify(result));
  }finally{globalThis.fetch=originalFetch;await c.end();}
}
main().then(()=>process.exit(0)).catch(()=>{console.error("Read-only verification diagnostic stopped. No raw error, provider body or secret is displayed. No initialization or settlement was requested.");process.exit(1);});
