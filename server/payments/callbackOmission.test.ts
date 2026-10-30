import {afterEach,expect,it,vi} from 'vitest';
import {getPaystackConfig,provider} from './paystack';
import {assertOwnedTestDatabase} from './testGuard';
vi.mock('./testGuard',()=>({assertOwnedTestDatabase:vi.fn(async()=>{})}));
const attempt={id:1,reference:'SST-offline-omission',amount:'50000.00',currency:'NGN',mode:'test'} as any;
function setup(mode?:string){
  for(const[key,value]of Object.entries({HOST:'127.0.0.1',DATABASE_URL:'mysql://offline:unused@127.0.0.1:3307/southside_development',SOUTHSIDE_PAYMENTS_MODE:'test',PAYSTACK_TEST_NETWORK_APPROVED:'1',SOUTHSIDE_PHASE9_BASELINE_ID:'7',SOUTHSIDE_PAYSTACK_WEBHOOKS:'disabled',PAYSTACK_SECRET_KEY:'sk_test_offline',PAYSTACK_PUBLIC_KEY:'pk_test_offline',STAFF_AUTH_ORIGIN:'http://127.0.0.1:3001'}))vi.stubEnv(key,value);
  vi.stubEnv('SOUTHSIDE_PAYSTACK_CALLBACK_MODE',mode);
  vi.spyOn(console,'warn').mockImplementation(()=>{});
}
const success=()=>new Response(JSON.stringify({status:true,data:{reference:attempt.reference,authorization_url:'https://checkout.paystack.com/offline'}}));
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();vi.unstubAllGlobals();});
it('omits the callback property entirely while preserving every binding and exact amount',async()=>{
  setup('omit');const transport=vi.fn(async()=>success());vi.stubGlobal('fetch',transport);
  await expect(provider().initialize(attempt,'fixture@example.invalid','OFFLINE-BOOK')).resolves.toBe('https://checkout.paystack.com/offline');
  const options=(transport.mock.calls as any)[0][1],body=JSON.parse(options.body);
  expect(body).toEqual({email:'fixture@example.invalid',amount:'5000000',currency:'NGN',reference:attempt.reference,metadata:{booking_reference:'OFFLINE-BOOK',attempt_reference:attempt.reference}});
  expect(Object.hasOwn(body,'callback_url')).toBe(false);expect(transport).toHaveBeenCalledTimes(1);
  expect(options.body).not.toContain('127.0.0.1');expect(options.redirect).toBe('error');
});
it.each([undefined,'return'])('preserves the existing callback when mode is %s',async mode=>{
  setup(mode);const transport=vi.fn(async()=>success());vi.stubGlobal('fetch',transport);
  await provider().initialize(attempt,'fixture@example.invalid','OFFLINE-BOOK');
  expect(JSON.parse((transport.mock.calls as any)[0][1].body).callback_url).toBe('http://127.0.0.1:3001/payment/return');
});
it.each(['','OMIT','disabled','https://unexpected.invalid'])('fails closed before a request for invalid mode %s',async mode=>{
  setup(mode);const transport=vi.fn();vi.stubGlobal('fetch',transport);
  expect(getPaystackConfig()).toEqual({enabled:false,mode:'disabled'});expect(()=>provider()).toThrow();expect(transport).not.toHaveBeenCalled();
});
it('does not construct an unused callback, while default mode still validates its origin',async()=>{
  setup('omit');vi.stubEnv('STAFF_AUTH_ORIGIN','invalid-origin');const transport=vi.fn(async()=>success());vi.stubGlobal('fetch',transport);
  await provider().initialize(attempt,'fixture@example.invalid','OFFLINE-BOOK');
  vi.stubEnv('SOUTHSIDE_PAYSTACK_CALLBACK_MODE','return');
  await expect(provider().initialize(attempt,'fixture@example.invalid','OFFLINE-BOOK')).rejects.toMatchObject({diagnostic:{category:'callback_url_invalid'}});expect(transport).toHaveBeenCalledTimes(1);
});
it('retains database ownership enforcement with omission selected',async()=>{
  setup('omit');vi.mocked(assertOwnedTestDatabase).mockRejectedValueOnce(Error('offline ownership failure'));
  const transport=vi.fn();vi.stubGlobal('fetch',transport);
  await expect(provider().initialize(attempt,'fixture@example.invalid','OFFLINE-BOOK')).rejects.toMatchObject({diagnostic:{category:'database_guard_failed'}});expect(transport).not.toHaveBeenCalled();
});
it.each([['PAYSTACK_SECRET_KEY','sk_live_never'],['DATABASE_URL','mysql://offline:unused@127.0.0.1:3307/southside_integration'],['SOUTHSIDE_PAYSTACK_WEBHOOKS','enabled']])('omission cannot override safety gate %s',(key,value)=>{
  setup('omit');vi.stubEnv(key,value);expect(getPaystackConfig().enabled).toBe(false);
});
it.each(['not_found','rate_limited','missing_params'])('records only reviewed HTTP error code %s and never retries',async code=>{
  setup('omit');const transport=vi.fn(async()=>new Response(JSON.stringify({type:'validation_error',code,message:'PRIVATE_BODY',data:{reference:attempt.reference}}),{status:400}));vi.stubGlobal('fetch',transport);
  await expect(provider().initialize(attempt,'fixture@example.invalid','OFFLINE-BOOK')).rejects.toMatchObject({code:'SERVICE_UNAVAILABLE',diagnostic:{httpStatus:400,providerError:{providerCode:code}}});
  expect(transport).toHaveBeenCalledTimes(1);const logs=JSON.stringify(vi.mocked(console.warn).mock.calls);expect(logs).not.toContain('PRIVATE_BODY');expect(logs).not.toContain(attempt.reference);expect(logs).not.toContain('fixture@example.invalid');
});
it('authoritative verification remains an independent GET in omission mode',async()=>{
  setup('omit');const transport=vi.fn(async()=>new Response(JSON.stringify({status:true,data:{id:1,status:'success',amount:5000000,currency:'NGN',domain:'test',reference:attempt.reference,metadata:{booking_reference:'OFFLINE-BOOK',attempt_reference:attempt.reference}}})));vi.stubGlobal('fetch',transport);
  expect(await provider().verify(attempt,'OFFLINE-BOOK')).toMatchObject({amount:5000000,domain:'test',reference:attempt.reference,bookingReference:'OFFLINE-BOOK'});
  const[url,options]=(transport.mock.calls as any)[0];expect(url).toBe(`https://api.paystack.co/transaction/verify/${attempt.reference}`);expect(options.method).toBe('GET');expect(options.body).toBeUndefined();
});
