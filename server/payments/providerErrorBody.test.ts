import {afterEach,expect,it,vi} from 'vitest';
import {inspectProviderError} from './providerErrorBody';
import {provider} from './paystack';
vi.mock('./testGuard',()=>({assertOwnedTestDatabase:vi.fn(async()=>{})}));
const secret='PRIVATE_SENTINEL';
const inspect=(body:string)=>inspectProviderError(new Response(body,{status:400}),new AbortController().signal);
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();vi.unstubAllEnvs();});
it('projects documented validation category/code and explicit field names only',async()=>{
  const result=await inspect(JSON.stringify({type:'validation_error',code:'missing_params',message:`email ${secret}@example.invalid`,field:'amount',errors:{email:[secret],metadata:secret,[secret]:secret},meta:{field:'currency',next_step:secret},data:{authorization:secret}}));
  expect(result).toEqual({bodyState:'parsed',providerCategory:'validation_error',providerCode:'missing_params',validationFields:['amount','currency','email','metadata']});
  expect(JSON.stringify(result)).not.toContain(secret);
});
it.each(['api_error','processor_error'])('retains documented category %s',async type=>{expect((await inspect(JSON.stringify({type}))).providerCategory).toBe(type);});
it('drops unknown codes, categories, messages and field values',async()=>{
  expect(await inspect(JSON.stringify({type:secret,code:secret,message:secret,field:secret,errors:[{field:'callback_url',message:secret},{field:secret}],meta:{next_step:secret}}))).toEqual({bodyState:'parsed',providerCategory:'unrecognized',providerCode:'unrecognized',validationFields:['callback_url']});
});
it.each(['{}',JSON.stringify({message:secret})])('handles missing structured error fields: %s',async body=>{expect(await inspect(body)).toEqual({bodyState:'parsed',providerCategory:null,providerCode:null,validationFields:[]});});
it.each(['not JSON','<html>PRIVATE_SENTINEL</html>','null','[]','"PRIVATE_SENTINEL"'])('handles malformed/unexpected JSON without exposing text: %s',async body=>{expect((await inspect(body)).bodyState).toBe('malformed');});
it('handles empty and oversized bodies',async()=>{expect((await inspect('')).bodyState).toBe('empty');expect((await inspect(secret.repeat(2000))).bodyState).toBe('too_large');});
it('counts bytes rather than characters and cancels oversized streams',async()=>{
  const cancel=vi.fn();let sends=0;
  const stream=new ReadableStream<Uint8Array>({pull(c){sends++;c.enqueue(new TextEncoder().encode('é'.repeat(3000)));},cancel});
  expect((await inspectProviderError(new Response(stream),new AbortController().signal)).bodyState).toBe('too_large');expect(cancel).toHaveBeenCalled();expect(sends).toBeLessThan(5);
});
it('bounds field count and never recursively searches arbitrary payloads',async()=>{
  const names=['email','amount','currency','reference','callback_url','metadata','channels','plan','invoice_limit','split_code'];
  const result=await inspect(JSON.stringify({errors:Object.fromEntries(names.map(n=>[n,secret])),data:{field:'bearer'}}));
  expect(result.validationFields).toHaveLength(8);expect(result.validationFields).not.toContain('bearer');expect(JSON.stringify(result).length).toBeLessThan(512);
});
it('times out a stalled body without waiting for stream cancellation',async()=>{
  vi.useFakeTimers();const stream=new ReadableStream<Uint8Array>({cancel:()=>new Promise(()=>{})});
  const pending=inspectProviderError(new Response(stream),new AbortController().signal);
  await vi.advanceTimersByTimeAsync(1500);expect((await pending).bodyState).toBe('timeout');
});
it('honors the existing request deadline and redacts stream errors',async()=>{
  const controller=new AbortController();controller.abort();
  expect((await inspectProviderError(new Response(new ReadableStream()),controller.signal)).bodyState).toBe('timeout');
  const stream=new ReadableStream({start(c){c.error(Error(secret));}});
  expect(await inspectProviderError(new Response(stream),new AbortController().signal)).toEqual({bodyState:'read_failed',providerCategory:null,providerCode:null,validationFields:[]});
});
it('integrates safe HTTP 400 diagnostics with one request and unchanged guest error',async()=>{
  for(const[key,value]of Object.entries({HOST:'127.0.0.1',DATABASE_URL:'mysql://offline:unused@127.0.0.1:3307/southside_development',SOUTHSIDE_PAYMENTS_MODE:'test',PAYSTACK_TEST_NETWORK_APPROVED:'1',SOUTHSIDE_PHASE9_BASELINE_ID:'7',SOUTHSIDE_PAYSTACK_WEBHOOKS:'disabled',PAYSTACK_SECRET_KEY:'sk_test_offline',PAYSTACK_PUBLIC_KEY:'pk_test_offline',STAFF_AUTH_ORIGIN:'http://127.0.0.1:3001'}))vi.stubEnv(key,value);
  const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
  const fetch=vi.fn(async()=>new Response(JSON.stringify({type:'validation_error',code:'missing_params',field:'email',message:secret,data:{reference:secret,authorization:secret}}),{status:400}));vi.stubGlobal('fetch',fetch);
  await expect(provider().initialize({reference:secret,amount:'50000.00',currency:'NGN'} as any,secret,secret)).rejects.toMatchObject({code:'SERVICE_UNAVAILABLE',diagnostic:{httpStatus:400,stage:'http_response',providerError:{providerCategory:'validation_error',providerCode:'missing_params',validationFields:['email']}}});
  expect(fetch).toHaveBeenCalledTimes(1);expect(warn).toHaveBeenCalledTimes(1);expect(JSON.stringify(warn.mock.calls)).not.toContain(secret);expect(JSON.stringify(warn.mock.calls)).not.toContain('sk_test_offline');
});
