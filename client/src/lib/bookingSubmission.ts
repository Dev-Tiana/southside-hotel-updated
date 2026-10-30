import { bookingIntent } from "@shared/submission";
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function lastSubmission(){try{const id=localStorage.getItem("southside.booking.last.v1");return id&&uuid.test(id)?id:null;}catch{return null;}}

export async function persistentSubmission(input: Parameters<typeof bookingIntent>[0]) {
  const bytes = await crypto.subtle.digest("SHA-256",new TextEncoder().encode(bookingIntent(input)));
  const fingerprint = [...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,"0")).join("");
  const key = `southside.booking.v1.${fingerprint}`;
  // Persist before sending anything. If storage is unavailable, fail visibly
  // instead of silently losing retry safety. No guest details are persisted.
  if(!navigator.locks)throw Error("This browser does not support safe submission storage.");
  return navigator.locks.request(key,()=>{
    const existing = localStorage.getItem(key);
    const id=existing&&uuid.test(existing)?existing:crypto.randomUUID();localStorage.setItem(key,id);localStorage.setItem("southside.booking.last.v1",id);
    if(localStorage.getItem(key)!==id)throw Error("Safe browser storage is unavailable. Enable local storage before submitting.");
    return id;
  });
}
