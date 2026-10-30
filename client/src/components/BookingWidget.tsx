import { ArrowRight, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { hotelProfile } from "@shared/hotel";
import { hotelToday } from "@shared/operations";
import { trpc } from "@/lib/trpc";
import { persistentSubmission,lastSubmission } from "@/lib/bookingSubmission";

const plusDays = (value: string, days: number) => new Date(Date.parse(value) + days * 86400000).toISOString().slice(0, 10);
type Outputs = inferRouterOutputs<AppRouter>;
type Stay = { checkIn: string; checkOut: string; adults: number; children: number; rooms: number; roomSlug?: string };
const price = (value: number | string) => `₦${Number(value).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function BookingWidget({ compact = false, initialSlug = "" }: { compact?: boolean; initialSlug?: string }) {
  const [stay, setStay] = useState<Stay>({ checkIn: plusDays(hotelToday(), 1), checkOut: plusDays(hotelToday(), 3), adults: 2, children: 0, rooms: 1, roomSlug: initialSlug });
  const [searched, setSearched] = useState<Stay>();
  const [selected, setSelected] = useState<number>();
  const [guest, setGuest] = useState({ name: "", email: "", phone: "" });
  const [review, setReview] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [message, setMessage] = useState("");
  const [receipt, setReceipt] = useState<Outputs["booking"]["submit"]>();
  const submitting = useRef(false);
  const [preparing,setPreparing]=useState(false);
  const [previous,setPrevious]=useState<string|null>(null);
  useEffect(()=>setPrevious(lastSubmission()),[]);
  const recover=trpc.booking.recover.useMutation({onSuccess:value=>{if(value)setReceipt(value);else setMessage("No saved reservation was found yet. Wait, then retry recovery or submit the same details; do not start a changed request while the previous result is uncertain.");},onError:error=>setMessage(error.message)});
  const catalogue = trpc.hotel.rooms.useQuery(undefined, { retry: false });
  const terms = trpc.booking.terms.useQuery(undefined, { retry: false });
  const search = trpc.booking.search.useMutation({ onSuccess: (_data, input) => { setSearched(input); setMessage(""); }, onError: error => setMessage(error.message) });
  const submit = trpc.booking.submit.useMutation({
    onSuccess: value => { setReceipt(value); setGuest({ name: "", email: "", phone: "" }); setMessage(""); },
    onError: error => { setMessage(`${error.message} Retry with the same guest and stay details: your saved submission identifier prevents a duplicate reservation. If you change those details, contact the hotel first when the previous result is uncertain.`); },
    onSettled: () => { submitting.current = false; },
  });
  const nights = Math.max(0, Math.round((Date.parse(stay.checkOut) - Date.parse(stay.checkIn)) / 86400000));
  const chosen = search.data?.rooms.find(room => room.id === selected);
  const busy = submit.isPending || recover.isPending || search.isPending || preparing;
  function update(patch: Partial<Stay>) { setStay(s => ({ ...s, ...patch })); search.reset(); setSearched(undefined); setSelected(undefined); setReview(false); setAccepted(false); setMessage(""); }
  if (receipt) return <section className="booking-widget booking-widget-compact booking-receipt" aria-label="Reservation received" role="status">
    <small className="eyebrow">Reservation received</small><h2>Your reservation request is saved.</h2>
    <p>Booking reference: <strong data-booking-reference>{receipt.reference}</strong></p>
    <p>Status: <strong>{receipt.status}</strong>. {receipt.status === "pending manual confirmation" ? "Your stay is awaiting hotel review; it is not yet confirmed." : "This is the current saved reservation status. Contact the hotel with any questions."}</p>
    <p>Total: {price(receipt.total)} · Amount paid: {price(receipt.amountPaid)} · {receipt.nights} nights</p>
    <p>No payment was collected by this booking form. Contact the hotel with your reference for the next step. Keep this reference before closing the page; acknowledgement and administrator emails are queued with delivery disabled.</p>
    <div className="hero-actions"><Link className="button button-copper" href="/booking/manage">Request a change</Link><Link className="button button-outline" href="/payment">Payment status</Link><a className="button button-outline" href={`tel:${hotelProfile.phone.replaceAll(" ", "")}`}>Contact the hotel</a></div>
  </section>;
  return <section className={`booking-widget ${compact ? "booking-widget-compact" : ""}`} aria-label="Check availability">
    {previous&&<div className="booking-summary"><p>Lost the result of your last request? Recover it before making a new reservation. This works even when its rooms are no longer available.</p><button type="button" className="button button-outline recover-booking" disabled={recover.isPending||busy} onClick={()=>recover.mutate({submissionId:previous})}>{recover.isPending?"Checking saved request…":"Recover previous submission"}</button></div>}
    <div className="booking-widget-top"><div><small className="eyebrow">Plan your stay</small><h2>Check your dates</h2></div><span className="booking-time">{nights > 0 ? `${nights} night${nights === 1 ? "" : "s"}` : "Choose your dates"}</span></div>
    <form className="booking-form" onSubmit={event => { event.preventDefault(); setSelected(undefined); setReview(false); setMessage(""); search.mutate({ ...stay, roomSlug: stay.roomSlug || undefined }); }}>
      <label><span>Check in</span><input name="checkIn" type="date" value={stay.checkIn} min={hotelToday()} disabled={busy} onChange={event => update({ checkIn: event.target.value, ...(event.target.value >= stay.checkOut ? { checkOut: plusDays(event.target.value, 1) } : {}) })} required /></label>
      <label><span>Check out</span><input name="checkOut" type="date" value={stay.checkOut} min={stay.checkIn ? plusDays(stay.checkIn, 1) : hotelToday()} disabled={busy} onChange={event => update({ checkOut: event.target.value })} required /></label>
      {([['adults', 'Adults', 1, 12], ['children', 'Children', 0, 12], ['rooms', 'Rooms', 1, 5]] as const).map(([key, label, min, max]) => <label key={key}><span>{label}</span><select name={key} value={stay[key]} disabled={busy} onChange={e => update({ [key]: Number(e.target.value) })}>{Array.from({ length: max - min + 1 }, (_, i) => min + i).map(value => <option key={value}>{value}</option>)}</select></label>)}
      <label className="booking-room-select"><span>Room preference</span><select name="roomSlug" value={stay.roomSlug} disabled={busy} onChange={e => update({ roomSlug: e.target.value })}><option value="">Any room</option>{catalogue.data?.map(room => <option key={room.slug} value={room.slug}>{room.name}</option>)}</select></label>
      <button className="button button-copper booking-submit" type="submit" disabled={busy || search.isPending}>{search.isPending ? <><LoaderCircle className="spin" size={17} /> Checking</> : <>Check dates <ArrowRight size={17} /></>}</button>
    </form>
    {catalogue.error && <p role="alert">Room details are temporarily unavailable. <button className="text-link" type="button" onClick={() => void catalogue.refetch()}>Try again</button></p>}
    {message && <p className="booking-message" role="alert">{message}</p>}
    {search.data && searched && <div className="availability-result"><div><strong>{search.data.rooms.length ? "Available rooms" : "No rooms match those dates"}</strong><span>{search.data.configured ? "Availability and prices are checked again when you submit." : "Online inventory awaits hotel configuration. Please contact the hotel."}</span></div>
      {search.data.rooms.map(room => <button key={room.id} type="button" className="availability-row" disabled={busy} aria-pressed={selected === room.id} onClick={() => { setSelected(room.id); setReview(false); setAccepted(false); }}><span>{room.name}<small>Up to {room.maxOccupancy} guests per room · {room.available} available</small></span><span>{price(room.nightlyRate)} first night / room</span><b>{price(room.total)} total · Select</b></button>)}
    </div>}
    {chosen && searched && <div className="guest-booking">
      <h3>{review ? "Review your reservation request" : "Guest details"}</h3>
      <div className="booking-summary"><strong>{chosen.name}</strong><p>{searched.checkIn} to {searched.checkOut} · {chosen.nights} nights · {searched.rooms} room(s) · {searched.adults} adult(s), {searched.children} children</p>
        <details><summary>Nightly prices per room</summary><ul>{chosen.nightly.map(n => <li key={n.date}>{n.date}: {price(n.amount)}</li>)}</ul></details>
        <p><strong>Total: {price(chosen.total)}</strong> · NGN · No payment collected online.</p><p>Submission creates a request pending manual confirmation, subject to availability at submission.</p>
      </div>
      {!review ? <form className="booking-form guest-details-form" onSubmit={event => { event.preventDefault(); setReview(true); setMessage(""); }}>
        <label><span>Guest name</span><input name="name" autoComplete="name" value={guest.name} onChange={e => setGuest(g => ({ ...g, name: e.target.value }))} minLength={2} maxLength={160} required /></label>
        <label><span>Email</span><input name="email" type="email" autoComplete="email" value={guest.email} onChange={e => setGuest(g => ({ ...g, email: e.target.value }))} maxLength={320} required /></label>
        <label><span>Telephone</span><input name="phone" type="tel" autoComplete="tel" value={guest.phone} onChange={e => setGuest(g => ({ ...g, phone: e.target.value }))} minLength={7} maxLength={40} required /></label>
        <button className="button button-copper" type="submit">Review reservation</button>
      </form> : <form className="reservation-review" onSubmit={async event => {
        event.preventDefault(); if (!accepted || !terms.data?.available || submitting.current) return;
        submitting.current = true;setPreparing(true);
        try { const input={ ...searched,...guest,roomCategoryId:chosen.id,expectedTotal:chosen.total.toFixed(2),expectedTerms:terms.data.text }; const submissionId=await persistentSubmission(input);setPrevious(submissionId);submit.mutate({...input,submissionId}); }
        catch { submitting.current=false;setMessage("Safe submission storage is unavailable. Use a current browser with local storage enabled; no reservation was sent."); }
        finally {setPreparing(false);}
      }}>
        <p>{guest.name} · {guest.email} · {guest.phone}</p>
        {terms.isLoading ? <p role="status">Loading approved booking terms…</p> : terms.error ? <p role="alert">Booking terms are unavailable. <button type="button" className="text-link" onClick={() => void terms.refetch()}>Try again</button></p> : <div className="booking-terms"><strong>Hotel booking terms</strong><p>{terms.data?.text}</p></div>}
        <label className="consent-label"><input type="checkbox" checked={accepted} disabled={busy} onChange={e => setAccepted(e.target.checked)} required /><span>I accept the displayed booking terms and <Link href="/policies">privacy policy</Link>. I understand this request is unpaid and awaits hotel confirmation.</span></label>
        <div className="hero-actions"><button type="button" className="button button-outline" disabled={busy} onClick={() => setReview(false)}>Edit guest details</button><button type="submit" className="button button-copper" disabled={busy || !accepted || !terms.data?.available}>{busy ? "Submitting…" : "Submit reservation request"}</button></div>
      </form>}
    </div>}
    <div className="booking-message"><span>Need help? <a href={`tel:${hotelProfile.phone.replaceAll(" ", "")}`}>Call {hotelProfile.phone}</a> or <a href={hotelProfile.social.whatsapp} target="_blank" rel="noreferrer">WhatsApp the hotel</a></span></div>
  </section>;
}
