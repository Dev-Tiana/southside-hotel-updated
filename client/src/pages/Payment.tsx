import {useEffect,useState} from "react";
import {Link} from "wouter";
import {trpc} from "@/lib/trpc";
import {lastSubmission} from "@/lib/bookingSubmission";
import {paymentRequest} from "@/lib/paymentRequest";
import {SouthsideShell,SectionLabel} from "@/components/SouthsideShell";
import type {inferRouterOutputs} from "@trpc/server";
import type {AppRouter} from "../../../server/routers";
type Receipt=inferRouterOutputs<AppRouter>["payment"]["status"];
const amount=(v:string)=>`₦${Number(v).toLocaleString("en-NG",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
export default function Payment(){
  const [token,setToken]=useState<string|null>(null),[receipt,setReceipt]=useState<Receipt>(),[message,setMessage]=useState(""),[preparing,setPreparing]=useState(false);
  const config=trpc.payment.config.useQuery(undefined,{retry:false});
  const status=trpc.payment.status.useMutation({onSuccess:setReceipt,onError:e=>setMessage(e.message)});
  const verify=trpc.payment.verify.useMutation({onSuccess:r=>{setReceipt(r);setMessage("");},onError:e=>setMessage(e.message)});
  const initialize=trpc.payment.initialize.useMutation({onSuccess:r=>{try{if(r.paymentReference&&token)sessionStorage.setItem(`southside.payment.return.${r.paymentReference}`,token);setReceipt(r);setMessage("");}catch{setReceipt({...r,checkoutUrl:null});setMessage("Return-session storage is unavailable. Do not open checkout; contact the hotel with the payment reference.");}},onError:e=>setMessage(e.message)});
  const mock=trpc.payment.mockResolve.useMutation({onSuccess:r=>{setReceipt(r);window.location.href=`/payment/return?reference=${encodeURIComponent(r.paymentReference??"")}`;},onError:e=>setMessage(e.message)});
  const reference=typeof window==="undefined"?null:new URLSearchParams(window.location.search).get("reference");
  const mockPage=typeof window!=="undefined"&&window.location.pathname==="/payment/mock";
  useEffect(()=>{let saved:string|null=null;try{saved=reference?sessionStorage.getItem(`southside.payment.return.${reference}`):null;}catch{}saved??=lastSubmission();setToken(saved);if(saved){if(window.location.pathname==="/payment/return"&&reference)verify.mutate({submissionId:saved,reference});else status.mutate({submissionId:saved});}},[]);
  const busy=status.isPending||verify.isPending||initialize.isPending||mock.isPending||preparing;
  async function start(){if(!token)return;setPreparing(true);setMessage("");try{const requestId=await paymentRequest(token,receipt?.paymentStatus==="failed"||receipt?.paymentStatus==="abandoned");initialize.mutate({submissionId:token,requestId});}catch{setMessage("Safe browser storage is unavailable. No checkout was requested.");}finally{setPreparing(false);}}
  return <SouthsideShell><section className="page-content"><div className="page-width payment-page" style={{maxWidth:760}}><SectionLabel>Reservation payment</SectionLabel><h1>Payment status and receipt</h1>
    <div className="booking-summary"><strong>{config.data?.mode==="mock"?"LOCAL PAYMENT SIMULATION — no Paystack connection or real funds.":config.data?.mode==="test"?"PAYSTACK TEST MODE — fictional transactions only.":"Payments are disabled."}</strong><p>Payment and hotel confirmation are separate. Paying never automatically confirms your stay.</p></div>
    {!token&&<p role="status">Open this page in the browser used to submit your booking, or recover your reservation first. A booking reference alone cannot authorize payment.</p>}
    {busy&&<p role="status">Checking saved payment information…</p>}{message&&<p role="alert">{message}</p>}
    {receipt&&<div className="booking-summary payment-receipt"><h2>{receipt.bookingReference}</h2><p>Booking status: <strong data-booking-status>{receipt.bookingStatus}</strong></p><p>Payment status: <strong data-payment-status>{receipt.paymentStatus}</strong>{receipt.reviewRequired?" — administrator review required. Do not pay again.":""}</p><p>Total: {amount(receipt.total)}<br/>Amount paid: <strong data-amount-paid>{amount(receipt.amountPaid)}</strong><br/>Outstanding: <strong data-outstanding>{amount(receipt.outstanding)}</strong></p>{receipt.paymentReference&&<p>Payment reference: <span data-payment-reference>{receipt.paymentReference}</span></p>}{receipt.message&&<p>Review information: {receipt.message.replaceAll("_"," ")}</p>}
      {receipt.paymentStatus==="succeeded"&&<p>The verified test payment was applied once. Your booking status remains {receipt.bookingStatus}.</p>}
      {["failed","abandoned"].includes(receipt.paymentStatus)&&<p>No payment was applied for this attempt. Your reservation and inventory status were not changed.</p>}
      {receipt.paymentStatus==="pending"&&<p>This payment is unresolved. Verify the same reference before starting another checkout.</p>}
    </div>}
    {mockPage&&reference&&config.data?.mode==="mock"&&receipt?.paymentReference===reference&&token?<div className="booking-summary mock-checkout"><h2>Fictional checkout simulator</h2><p>No card details are collected. These controls simulate provider outcomes for approved local test bookings.</p><div className="hero-actions">{(["success","failed","pending","abandoned"] as const).map(outcome=><button key={outcome} type="button" className="button button-copper" disabled={busy} onClick={()=>mock.mutate({submissionId:token,reference,outcome})}>Simulate {outcome}</button>)}</div></div>:<div className="hero-actions">
      {token&&receipt&&config.data?.enabled&&Number(receipt.outstanding)>0&&!receipt.reviewRequired&&["not started","failed","abandoned"].includes(receipt.paymentStatus)&&<button type="button" className="button button-copper start-payment" disabled={busy} onClick={()=>void start()}>Start test payment</button>}
      {receipt?.checkoutUrl&&!receipt.reviewRequired&&config.data?.enabled&&<a className="button button-copper open-checkout" href={receipt.checkoutUrl}>Open {config.data.mode==="mock"?"simulated":"Paystack test"} checkout</a>}
      {token&&receipt?.paymentReference&&config.data?.enabled&&<button type="button" className="button button-outline verify-payment" disabled={busy} onClick={()=>verify.mutate({submissionId:token,reference:receipt.paymentReference!})}>Verify payment status</button>}
      {token&&<button type="button" className="text-link" disabled={busy} onClick={()=>status.mutate({submissionId:token})}>Refresh saved receipt</button>}
    </div>}
    <p><Link className="text-link" href="/booking">Booking and recovery</Link> · <Link className="text-link" href="/contact">Contact the hotel</Link></p>
  </div></section></SouthsideShell>;
}
