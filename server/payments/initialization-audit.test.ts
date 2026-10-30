// Pure offline reproductions: fetch is replaced before the production adapter
// is invoked. No database, Paystack connection or real reference is created.
import {afterEach,expect,it,vi} from "vitest";
import {spawn} from "node:child_process";
import {provider} from "./paystack";
vi.mock("./testGuard",()=>({assertOwnedTestDatabase:vi.fn(async()=>{})}));
const reference="SST-00000000000040008000000000000009";
const attempt={reference,amount:"50000.00",currency:"NGN",mode:"test"} as any;
const envelope={status:true,data:{reference,authorization_url:"https://checkout.paystack.com/offline-fixture"}};
function config(){
  for(const[key,value]of Object.entries({HOST:"127.0.0.1",DATABASE_URL:"mysql://offline:unused@127.0.0.1:3307/southside_development",SOUTHSIDE_PAYMENTS_MODE:"test",PAYSTACK_TEST_NETWORK_APPROVED:"1",SOUTHSIDE_PHASE9_BASELINE_ID:"7",SOUTHSIDE_PAYSTACK_WEBHOOKS:"disabled",PAYSTACK_SECRET_KEY:"sk_test_offline",PAYSTACK_PUBLIC_KEY:"pk_test_offline",STAFF_AUTH_ORIGIN:"http://127.0.0.1:3001"}))vi.stubEnv(key,value);
}
function simulatedDeadline(){
  vi.useFakeTimers();
  vi.spyOn(AbortSignal,"timeout").mockImplementation(ms=>{const controller=new AbortController();setTimeout(()=>controller.abort(new DOMException("offline simulated deadline","TimeoutError")),ms);return controller.signal;});
}
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllEnvs();vi.unstubAllGlobals();});
it("reconstructs the existing amount, authentication and payload without an external request",async()=>{
  config();const transport=vi.fn().mockResolvedValue(new Response(JSON.stringify(envelope)));vi.stubGlobal("fetch",transport);
  expect(await provider().initialize(attempt,"phase9-first@example.invalid","SSFICTIONAL09")).toBe(envelope.data.authorization_url);
  expect(transport).toHaveBeenCalledTimes(1);const[url,options]=transport.mock.calls[0];
  expect(url).toBe("https://api.paystack.co/transaction/initialize");expect(options.method).toBe("POST");expect(options.redirect).toBe("error");expect(options.headers).toEqual({Authorization:"Bearer sk_test_offline","Content-Type":"application/json"});
  expect(JSON.parse(options.body)).toEqual({email:"phase9-first@example.invalid",amount:"5000000",currency:"NGN",reference,callback_url:"http://127.0.0.1:3001/payment/return",metadata:{booking_reference:"SSFICTIONAL09",attempt_reference:reference}});
  expect(options.body).not.toContain("sk_test_");expect(options.body).not.toContain("pk_test_");expect(options.signal).toBeInstanceOf(AbortSignal);
});
it("classifies a before-response deadline while preserving the generic guest error",async()=>{
  config();simulatedDeadline();let observed:AbortSignal|undefined;
  const transport=vi.fn(async(_url,options)=>{observed=options.signal;return new Promise<Response>((_resolve,reject)=>options.signal.addEventListener("abort",()=>reject(options.signal.reason),{once:true}));});vi.stubGlobal("fetch",transport);
  const assertion=expect(provider().initialize(attempt,"phase9-first@example.invalid","SSFICTIONAL09")).rejects.toMatchObject({code:"SERVICE_UNAVAILABLE",diagnostic:{stage:"request",category:"request_timeout",headersReceived:false,httpStatus:null}});
  await vi.advanceTimersByTimeAsync(9999);expect(observed?.aborted).toBe(false);await vi.advanceTimersByTimeAsync(1);await assertion;expect(observed?.aborted).toBe(true);expect(transport).toHaveBeenCalledTimes(1);
});
it("distinguishes an HTTP-200 body-read deadline from a request deadline",async()=>{
  config();simulatedDeadline();let headersReceived=false;
  vi.stubGlobal("fetch",vi.fn(async(_url,options)=>{headersReceived=true;const stream=new ReadableStream({start(controller){options.signal.addEventListener("abort",()=>controller.error(options.signal.reason),{once:true});}});return new Response(stream,{status:200});}));
  const assertion=expect(provider().initialize(attempt,"phase9-first@example.invalid","SSFICTIONAL09")).rejects.toMatchObject({code:"SERVICE_UNAVAILABLE",diagnostic:{stage:"response_body",category:"response_body_timeout",headersReceived:true,httpStatus:200}});
  await vi.advanceTimersByTimeAsync(10000);await assertion;expect(headersReceived).toBe(true);
});
it.each(["not-json",JSON.stringify({status:false,message:"OFFLINE_PROVIDER_REJECTION"}),JSON.stringify({status:true}),JSON.stringify({status:true,data:{reference}})])("rejects a malformed or incomplete provider response offline: %s",async body=>{
  config();vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(body,{status:200})));await expect(provider().initialize(attempt,"phase9-first@example.invalid","SSFICTIONAL09")).rejects.toMatchObject({code:"SERVICE_UNAVAILABLE"});
});
it("does not lose an inherited credential when the launcher removes its local env-object property after spawn",async()=>{
  const env={...process.env,PAYSTACK_SECRET_KEY:"sk_test_offline"};
  const child=spawn(process.execPath,["--input-type=module","-e","process.stdout.write(String(process.env.PAYSTACK_SECRET_KEY==='sk_test_offline'))"],{env,windowsHide:true,stdio:["ignore","pipe","pipe"]});
  delete (env as Partial<typeof env>).PAYSTACK_SECRET_KEY;
  let output="";child.stdout.on("data",chunk=>{output+=chunk;});const code=await new Promise<number|null>((resolve,reject)=>{child.once("error",reject);child.once("exit",resolve);});expect(code).toBe(0);expect(output).toBe("true");
});
