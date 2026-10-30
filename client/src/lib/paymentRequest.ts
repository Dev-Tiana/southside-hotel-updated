export async function paymentRequest(submissionId:string,renew=false){
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(submissionId));const key="southside.payment.request."+[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,"0")).join("");
  if(!navigator.locks)throw Error("Safe browser storage is required.");
  return navigator.locks.request(key,()=>{const old=localStorage.getItem(key);const id=!renew&&old&&/^[a-f0-9-]{36}$/i.test(old)?old:crypto.randomUUID();localStorage.setItem(key,id);if(localStorage.getItem(key)!==id)throw Error("Safe browser storage is required.");return id;});
}
