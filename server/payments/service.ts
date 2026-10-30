import {createHash,randomUUID} from "node:crypto";
import {TRPCError} from "@trpc/server";
import {cents,money,reservationRevision,reject} from "../management/domain";
import {dateKey,hotelToday} from "../../shared/operations";
import {paymentRepository,type PaymentRepository,type PaymentUnit,type Attempt} from "./repository";
import {provider,type PaymentProvider,type VerifiedPayment} from "./paystack";
import {assertPhase9Fixture} from "./testGuard";
const hash=(value:string)=>createHash("sha256").update(value).digest("hex");
function access():never{throw new TRPCError({code:"NOT_FOUND",message:"Booking access or payment reference could not be verified."});}
function eligible(r:PaymentUnit["reservation"]){return ["pending manual confirmation","pending payment","confirmed"].includes(r.status)&&dateKey(r.checkIn)>=hotelToday();}
function receipt(u:PaymentUnit,a?:Attempt){return{bookingReference:u.reservation.reference,bookingStatus:u.reservation.status,total:u.reservation.total,amountPaid:u.reservation.amountPaid,outstanding:u.reservation.outstanding,currency:u.reservation.currency,paymentStatus:a?.status??"not started",paymentReference:a?.reference??null,mode:a?.mode??null,reviewRequired:a?.status==="review required"||(a?.status==="succeeded"&&Boolean(a.lastErrorCode)),message:a?.lastErrorCode??null,checkoutUrl:a?.status==="pending"?a.authorizationUrl:null};}
export function paymentService(repo:PaymentRepository=paymentRepository,resolveProvider:()=>PaymentProvider=provider){
  async function booking(submissionId:string){const id=await repo.capability(submissionId);if(!id)access();return id;}
  async function owned(submissionId:string,reference:string){const id=await booking(submissionId),a=await repo.reference(reference);if(!a||a.reservationId!==id)access();return a;}
  async function initialize(submissionId:string,requestId:string){
    const p=resolveProvider(),id=await booking(submissionId),key=hash(requestId.toLowerCase());
    const prepared=await repo.withReservation(id,async u=>{
      if(p.mode==="test")assertPhase9Fixture(u.reservation.id,u.guest.name,u.guest.email);
      const existing=u.attempts.find(a=>a.requestKeyHash===key);if(existing){if(existing.mode!==p.mode)reject("Payment environments cannot be mixed.");return{attempt:existing,email:u.guest.email,bookingReference:u.reservation.reference,fresh:false};}
      if(!/^Phase Eight Fictional\b/.test(u.guest.name)||!u.guest.email.toLowerCase().endsWith("@example.invalid"))reject("This test-only phase accepts newly created Phase Eight Fictional guests at example.invalid addresses.","PRECONDITION_FAILED");
      if(!eligible(u.reservation))reject("This reservation is stale or not eligible for payment.");
      const total=cents(u.reservation.total),paid=cents(u.reservation.amountPaid),due=cents(u.reservation.outstanding);
      if(u.reservation.currency!=="NGN"||paid+due!==total||paid>total||due<=0n)reject("The saved booking balance is not eligible for a new charge.");
      if(u.attempts.some(a=>a.status==="review required"||a.lastErrorCode==="post_settlement_status_changed"))reject("A payment needs administrator review. Do not pay again.");
      const active=u.attempts.find(a=>a.activeReservationId===id);if(active){if(active.mode!==p.mode)reject("An unresolved payment exists in another environment.");return{attempt:active,email:u.guest.email,bookingReference:u.reservation.reference,fresh:false};}
      const attempt=await u.insertAttempt({reservationId:id,activeReservationId:id,requestKeyHash:key,reference:`SST-${randomUUID().replaceAll("-","")}`,amount:money(due),currency:"NGN",reservationRevision:reservationRevision(u.reservation),mode:p.mode,status:"initializing"});
      await u.event(attempt.id,hash(`${attempt.reference}:initialize`),"guest","initializing",null,{amount:attempt.amount,currency:"NGN",mode:p.mode});await u.audit("payment.initialize",{attemptId:attempt.id,reference:attempt.reference,amount:attempt.amount,mode:p.mode});
      return{attempt,email:u.guest.email,bookingReference:u.reservation.reference,fresh:true};
    });
    if(prepared.fresh){
      let url:string|undefined;try{url=await p.initialize(prepared.attempt,prepared.email,prepared.bookingReference);}catch{/* An ambiguous provider timeout must not create a new charge. */}
      await repo.withReservation(id,async u=>{const a=u.attempts.find(a=>a.id===prepared.attempt.id)!;if(a.status!=="initializing")return;
        const stale=reservationRevision(u.reservation)!==a.reservationRevision||!eligible(u.reservation);
        const reason=stale?"reservation_changed_during_initialization":url?null:"initialization_uncertain";
        await u.updateAttempt(a.id,{status:stale?"review required":"pending",authorizationUrl:stale?null:url??null,lastErrorCode:reason});await u.event(a.id,hash(`${a.reference}:initialized:${reason??"ok"}`),"provider","pending",reason,{checkoutAvailable:Boolean(url)&&!stale});
      });
    }
    return repo.withReservation(id,async u=>receipt(u,u.attempts.find(a=>a.id===prepared.attempt.id)));
  }
  async function apply(a:Attempt,v:VerifiedPayment,source:string,actorId?:number){
    return repo.withReservation(a.reservationId,async u=>{
      const current=u.attempts.find(x=>x.id===a.id);if(!current)access();
      const r=u.reservation;
      let reason:string|null=null;
      if(v.reference!==current.reference||v.attemptReference!==current.reference||v.bookingReference!==r.reference)reason="reference_binding_mismatch";
      else if(v.domain!=="test")reason="non_test_transaction_rejected";
      else if(v.currency!==current.currency||v.currency!==r.currency)reason="currency_mismatch";
      else if(!Number.isSafeInteger(v.amount)||v.amount!==Number(cents(current.amount)))reason="amount_mismatch";
      else if(!v.id||!(/^(mock-\d+|\d+)$/.test(v.id))||(current.mode==="test"&&!/^\d+$/.test(v.id)))reason="invalid_provider_transaction";
      else{const owner=await u.transactionOwner(v.id);if(owner&&owner!==current.id)reason="provider_transaction_already_used";}
      const details={providerId:v.id,providerStatus:v.status,amountMinor:Number.isSafeInteger(v.amount)?v.amount:null,currency:v.currency,domain:v.domain};
      const eventKey=hash(JSON.stringify({reference:current.reference,...details}));
      if(current.status==="succeeded"){
        if(reason||current.providerTransactionId!==v.id||v.status!=="success"){
          const code=reason??(current.providerTransactionId!==v.id?"conflicting_settlement_identity":"post_settlement_status_changed");
          if(await u.event(current.id,eventKey,source,"review required",code,details)){await u.updateAttempt(current.id,{lastErrorCode:code});await u.audit("payment.review",{attemptId:current.id,reason:code,details},actorId);}
          return receipt(u,{...current,lastErrorCode:code});
        }
        return receipt(u,current);
      }
      if(!["success","failed","abandoned","pending","ongoing","processing","queued","reversed"].includes(v.status))reason??="unsupported_provider_status";
      if(current.status==="review required")reason??=current.lastErrorCode??"existing_attempt_requires_review";
      if(v.status==="reversed")reason??="reversal_requires_review";
      if(v.status==="success"&&!reason){
        if(!eligible(r)||reservationRevision(r)!==current.reservationRevision)reason="stale_reservation";
        else if(cents(r.amountPaid)+cents(r.outstanding)!==cents(r.total)||cents(current.amount)!==cents(r.outstanding)||cents(r.amountPaid)+cents(current.amount)>cents(r.total))reason="balance_changed_or_overpayment";
      }
      if(reason){
        if(await u.event(current.id,eventKey,source,"review required",reason,details)){await u.updateAttempt(current.id,{status:"review required",providerStatus:v.status,lastErrorCode:reason});await u.audit("payment.review",{attemptId:current.id,reason,details},actorId);}
        return receipt(u,{...current,status:"review required",providerStatus:v.status,lastErrorCode:reason});
      }
      const status=v.status==="success"?"succeeded":v.status==="failed"?"failed":v.status==="abandoned"?"abandoned":"pending";
      if(!await u.event(current.id,eventKey,source,status,null,details))return receipt(u,current);
      const patch={status,providerTransactionId:v.id,providerStatus:v.status,lastErrorCode:null,activeReservationId:status==="pending"?current.activeReservationId:null} as const;
      await u.updateAttempt(current.id,patch);
      if(status==="succeeded"){
        const amountPaid=money(cents(r.amountPaid)+cents(current.amount)),outstanding=money(cents(r.outstanding)-cents(current.amount));
        await u.credit(current,amountPaid,outstanding);
        for(const other of u.attempts.filter(x=>x.id!==current.id&&x.activeReservationId!==null))await u.updateAttempt(other.id,{activeReservationId:null,status:"review required",lastErrorCode:"superseded_by_verified_payment"});
        await u.audit("payment.applied",{attemptId:current.id,reference:current.reference,providerTransactionId:v.id,amount:current.amount,before:{amountPaid:r.amountPaid,outstanding:r.outstanding},after:{amountPaid,outstanding},bookingStatus:r.status,mode:current.mode},actorId);
        return receipt({...u,reservation:{...r,amountPaid,outstanding}},{...current,...patch});
      }
      await u.audit("payment.observed",{attemptId:current.id,status,providerStatus:v.status,mode:current.mode},actorId);return receipt(u,{...current,...patch});
    });
  }
  async function verifyAttempt(a:Attempt,source:string,actorId?:number){
    const p=resolveProvider();if(p.mode!==a.mode)reject("Payment environments cannot be mixed.");
    const bookingReference=await repo.withReservation(a.reservationId,async u=>{if(p.mode==="test")assertPhase9Fixture(u.reservation.id,u.guest.name,u.guest.email);return u.reservation.reference;});
    let verified:VerifiedPayment;try{verified=await p.verify(a,bookingReference);}catch{throw new TRPCError({code:"SERVICE_UNAVAILABLE",message:"Provider verification is unavailable. Your booking balance was not changed; retry verification of this same reference."});}
    return apply(a,verified,source,actorId);
  }
  return{
    initialize,
    async status(submissionId:string){const id=await booking(submissionId);return repo.withReservation(id,async u=>receipt(u,u.attempts.at(-1)));},
    async verify(submissionId:string,reference:string){return verifyAttempt(await owned(submissionId,reference),"guest");},
    async adminVerify(reference:string,actorId:number){const a=await repo.reference(reference);if(!a)access();return verifyAttempt(a,"administrator",actorId);},
    async webhook(reference:string){const a=await repo.reference(reference);if(!a)return{ignored:true};const result=await verifyAttempt(a,"webhook");if(["pending","initializing"].includes(result.paymentStatus))throw new TRPCError({code:"SERVICE_UNAVAILABLE",message:"Authoritative verification is still pending. Retry this webhook."});return{accepted:true};},
    async mockResolve(submissionId:string,reference:string,outcome:string){const p=resolveProvider();if(p.mode!=="mock")throw new TRPCError({code:"FORBIDDEN",message:"Mock controls are unavailable."});const a=await owned(submissionId,reference);if(a.mode!=="mock")reject("Wrong payment environment.");await repo.withReservation(a.reservationId,async u=>{await u.updateAttempt(a.id,{mockOutcome:outcome});});return verifyAttempt({...a,mockOutcome:outcome},"mock_checkout");},
  };
}
export const paymentsService=paymentService();
