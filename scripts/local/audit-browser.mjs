// Connect only to separately owned local audit profiles. Never inspect cookies,
// authentication fields or storage, or inject an authenticated identity.
import assert from "node:assert/strict";
export const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function auditBrowser(port = 9224) {
  assert.ok([9223, 9224].includes(port));
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(3000) })).json();
  const page = pages.find(p => p.type === "page" && p.url.startsWith("http://127.0.0.1:3001/"));
  assert.ok(page, "Owned local audit browser unavailable");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener("open", resolve, { once: true }); ws.addEventListener("error", reject, { once: true }); });
  let next = 0; const pending = new Map();
  ws.addEventListener("message", event => { const r = JSON.parse(event.data); if (pending.has(r.id)) { const p = pending.get(r.id); clearTimeout(p.timer); pending.delete(r.id); r.error ? p.reject(new Error("Local browser command failed")) : p.resolve(r.result); } });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++next, timer = setTimeout(() => { pending.delete(id); reject(new Error("Local browser command timed out")); }, 15000); pending.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => { const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); assert.ok(!r.exceptionDetails, "Local browser evaluation failed"); return r.result.value; };
  const fill = async (selector, value) => { await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw Error('Control missing');const proto=el.tagName==='SELECT'?HTMLSelectElement.prototype:el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(String(value))});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`); await pause(150); };
  const wait = async (expression, message = "Expected local UI state did not appear") => { for (let n=0; n<100; n++) { const value = await evaluate(expression); if (value) return value; await pause(100); } throw new Error(message); };
  const onEvent=(method,listener)=>{const handler=event=>{const r=JSON.parse(event.data);if(r.method===method)listener(r.params);};ws.addEventListener("message",handler);return()=>ws.removeEventListener("message",handler);};
  return { send, evaluate, fill, wait, onEvent, close: () => ws.close() };
}
