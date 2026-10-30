import {afterEach,expect,it,vi} from "vitest";
import {provider} from "./paystack";
import {assertOwnedTestDatabase} from "./testGuard";
vi.mock("./testGuard",()=>({assertOwnedTestDatabase:vi.fn(async()=>{})}));
const privateValue="PRIVATE_KEY_GUEST_CARD_REFERENCE_URL_SENTINEL";
const reference="SST-00000000000040008000000000000009";
const attempt={reference,amount:"50000.00",currency:"NGN",mode:"test"} as any;
function setup(){
  for(const[key,value]of Object.entries({HOST:"127.0.0.1",DATABASE_URL:"mysql://offline:unused@127.0.0.1:3307/southside_development",SOUTHSIDE_PAYMENTS_MODE:"test",PAYSTACK_TEST_NETWORK_APPROVED:"1",SOUTHSIDE_PHASE9_BASELINE_ID:"7",SOUTHSIDE_PAYSTACK_WEBHOOKS:"disabled",PAYSTACK_SECRET_KEY:"sk_test_offline",PAYSTACK_PUBLIC_KEY:"pk_test_offline",STAFF_AUTH_ORIGIN:"http://127.0.0.1:3001"}))vi.stubEnv(key,value);
  vi.spyOn(console,"warn").mockImplementation(()=>{});
}
async function check(stage:string,category:string,options:{headersReceived:boolean;httpStatus:number|null;networkCodes?:string[]}){
  let caught:any;try{await provider().initialize(attempt,`${privateValue}@example.invalid`,privateValue);}catch(error){caught=error;}
  expect(caught?.code).toBe("SERVICE_UNAVAILABLE");expect(caught?.diagnostic).toMatchObject({operation:"initialize",stage,category,headersReceived:options.headersReceived,httpStatus:options.httpStatus});
  expect(caught.diagnostic.networkCodes).toEqual(options.networkCodes??[]);expect(caught.diagnostic.elapsedMs).toBeGreaterThanOrEqual(0);expect(caught.cause).toBeUndefined();
  const logs=JSON.stringify(vi.mocked(console.warn).mock.calls);expect(vi.mocked(console.warn)).toHaveBeenCalledTimes(1);
  const diagnostic=JSON.stringify(caught.diagnostic);
  for(const secret of [privateValue,reference,"sk_test_offline","pk_test_offline","50000","5000000","Authorization","authorization_url","https://"]){expect(logs).not.toContain(secret);expect(diagnostic).not.toContain(secret);}
  expect(Object.keys(caught.diagnostic).sort()).toEqual(["operation","stage","category","elapsedMs","headersReceived","httpStatus","networkCodes",...(stage==='http_response'?['providerError']:[])].sort());
}
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();vi.unstubAllGlobals();});
it.each(["ENOTFOUND","ECONNRESET","UNABLE_TO_GET_ISSUER_CERT_LOCALLY"])("logs a sanitized connection failure for %s",async code=>{setup();vi.stubGlobal("fetch",vi.fn().mockRejectedValue(Object.assign(Error(privateValue),{cause:{code,message:privateValue}})));await check("request","connection_failure",{headersReceived:false,httpStatus:null,networkCodes:[code]});});
it("drops unknown network codes and raw exception properties",async()=>{setup();vi.stubGlobal("fetch",vi.fn().mockRejectedValue(Object.assign(Error(privateValue),{code:privateValue,cause:{code:privateValue,body:privateValue}})));await check("request","connection_failure",{headersReceived:false,httpStatus:null});});
it("classifies request timeout without exposing its exception",async()=>{setup();vi.stubGlobal("fetch",vi.fn().mockRejectedValue(new DOMException(privateValue,"TimeoutError")));await check("request","request_timeout",{headersReceived:false,httpStatus:null});});
it.each([400,401,429,500])("retains HTTP %i safely when a readable response stream is unavailable",async status=>{setup();const body=vi.fn();vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:false,status,text:body}));await check("http_response","http_error",{headersReceived:true,httpStatus:status});expect(body).not.toHaveBeenCalled();});
it("distinguishes response body timeout after headers",async()=>{setup();vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,status:200,text:async()=>{throw new DOMException(privateValue,"TimeoutError");}}));await check("response_body","response_body_timeout",{headersReceived:true,httpStatus:200});});
it("distinguishes non-timeout body failures",async()=>{setup();vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,status:200,text:async()=>{throw Object.assign(Error(privateValue),{cause:{code:"ECONNRESET"}});}}));await check("response_body","response_body_failure",{headersReceived:true,httpStatus:200,networkCodes:["ECONNRESET"]});});
it("distinguishes JSON syntax errors without logging invalid text",async()=>{setup();vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(privateValue)));await check("json_parsing","json_parse_error",{headersReceived:true,httpStatus:200});});
it("distinguishes an unsuccessful provider envelope",async()=>{setup();vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(JSON.stringify({status:false,message:privateValue}))));await check("response_validation","provider_response_error",{headersReceived:true,httpStatus:200});});
it.each([[undefined,"checkout_url_missing"],[privateValue,"checkout_url_invalid"],[`https://user:${privateValue}@checkout.paystack.com/x`,"checkout_url_rejected"]])("distinguishes checkout URL validation: %s",async(url,category)=>{setup();vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(JSON.stringify({status:true,data:{reference,authorization_url:url}}))));await check("checkout_validation",category!,{headersReceived:true,httpStatus:200});});
it("distinguishes a reference mismatch without logging reference values",async()=>{setup();vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(JSON.stringify({status:true,data:{reference:privateValue,authorization_url:"https://checkout.paystack.com/offline"}}))));await check("reference_validation","reference_mismatch",{headersReceived:true,httpStatus:200});});
it("distinguishes a failed database guard before any transport call",async()=>{setup();vi.mocked(assertOwnedTestDatabase).mockRejectedValueOnce(Error(privateValue));const transport=vi.fn();vi.stubGlobal("fetch",transport);await check("database_guard","database_guard_failed",{headersReceived:false,httpStatus:null});expect(transport).not.toHaveBeenCalled();});
