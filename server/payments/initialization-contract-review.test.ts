// Hypothetical provider policies, not a reproduction of Paystack's private
// validator. No real keys, guest data, database or network are used.
import {afterEach,expect,it,vi} from 'vitest';
import {provider} from './paystack';
vi.mock('./testGuard',()=>({assertOwnedTestDatabase:vi.fn(async()=>{})}));
const attempt={reference:'SST-offline-contract',amount:'50000.00',currency:'NGN',mode:'test'} as any;
function configure(){
  for(const [key,value] of Object.entries({HOST:'127.0.0.1',DATABASE_URL:'mysql://offline:unused@127.0.0.1:3307/southside_development',SOUTHSIDE_PAYMENTS_MODE:'test',PAYSTACK_TEST_NETWORK_APPROVED:'1',SOUTHSIDE_PHASE9_BASELINE_ID:'7',SOUTHSIDE_PAYSTACK_WEBHOOKS:'disabled',PAYSTACK_SECRET_KEY:'sk_test_offline',PAYSTACK_PUBLIC_KEY:'pk_test_offline',STAFF_AUTH_ORIGIN:'http://127.0.0.1:3001'}))vi.stubEnv(key,value);
}
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();vi.unstubAllGlobals();});
it('checks the wire fields and documents the endpoint-table metadata discrepancy',async()=>{
  configure();vi.spyOn(console,'warn').mockImplementation(()=>{});
  const transport=vi.fn(async(_url:string,options:any)=>{
    const body=JSON.parse(options.body);
    expect(typeof body.email).toBe('string');expect(body.amount).toBe('5000000');
    expect(body.currency).toBe('NGN');expect(body.reference).toMatch(/^[A-Za-z0-9.=-]+$/);
    expect(new URL(body.callback_url).href).toBe('http://127.0.0.1:3001/payment/return');
    expect(typeof body.metadata).toBe('object'); // API table says String; guide shows Object.
    const canonical={...body,metadata:JSON.stringify(body.metadata)};
    expect(typeof canonical.metadata).toBe('string');
    expect(JSON.parse(canonical.metadata)).toEqual(body.metadata); // proposed only, not sent
    return new Response(JSON.stringify({status:false,message:'OFFLINE_METADATA_STRING_REQUIRED'}),{status:400});
  });vi.stubGlobal('fetch',transport);
  await expect(provider().initialize(attempt,'fixture@example.invalid','OFFLINE-BOOK')).rejects.toMatchObject({diagnostic:{stage:'http_response',httpStatus:400}});
  expect(transport).toHaveBeenCalledTimes(1);
});
it.each(['metadata_policy','email_domain_policy','callback_policy','account_currency_policy'])('different hypothetical rejections are indistinguishable in existing diagnostics: %s',async reason=>{
  configure();const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
  const bodyRead=vi.fn();
  const transport=vi.fn(async()=>({ok:false,status:400,text:bodyRead}));vi.stubGlobal('fetch',transport);
  await expect(provider().initialize(attempt,'fixture@example.invalid','OFFLINE-BOOK')).rejects.toMatchObject({diagnostic:{operation:'initialize',stage:'http_response',category:'http_error',httpStatus:400,headersReceived:true,networkCodes:[]}});
  expect(bodyRead).not.toHaveBeenCalled();expect(transport).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(warn.mock.calls)).not.toContain(reason);
  expect(JSON.stringify(warn.mock.calls)).not.toContain('fixture@example.invalid');
  expect(JSON.stringify(warn.mock.calls)).not.toContain('sk_test_offline');
});
it('an object-accepting mock accepts the identical current payload, so mock success is not provider proof',async()=>{
  configure();const transport=vi.fn(async(_url:string,options:any)=>{
    expect(typeof JSON.parse(options.body).metadata).toBe('object');
    return new Response(JSON.stringify({status:true,data:{reference:attempt.reference,authorization_url:'https://checkout.paystack.com/offline-contract'}}));
  });vi.stubGlobal('fetch',transport);
  await expect(provider().initialize(attempt,'fixture@example.invalid','OFFLINE-BOOK')).resolves.toBe('https://checkout.paystack.com/offline-contract');
  expect(transport).toHaveBeenCalledTimes(1);
});
