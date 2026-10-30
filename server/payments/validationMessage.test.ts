import {afterEach,expect,it,vi} from 'vitest';
import {classifyValidationMessage} from './validationMessage';
import {inspectProviderError,safeProviderError} from './providerErrorBody';
import {provider} from './paystack';
vi.mock('./testGuard',()=>({assertOwnedTestDatabase:vi.fn(async()=>{})}));
const fixtures=[
  ['amount_invalid','You must specify a valid amount'],
  ['amount_invalid','Amount must be an integer'],
  ['email_invalid','Invalid Email Address Passed'],
  ['email_missing','Email Address is required'],
  ['merchant_disabled','Invalid Merchant Selected'],
  ['reference_invalid','Invalid character in transaction reference'],
  ['currency_not_enabled','Currency not supported by merchant'],
] as const;
const inspect=(value:unknown)=>inspectProviderError(new Response(JSON.stringify(value),{status:400}),new AbortController().signal);
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();vi.unstubAllGlobals();});
it.each(fixtures)('classifies documented fixture as fixed local label %s',async(label,message)=>{
  expect(classifyValidationMessage(message)).toBe(label);
  const result=await inspect({type:'validation_error',message,code:'unknown-provider-code'});
  expect(result.messageLabel).toBe(label);expect(safeProviderError(result)).toEqual(result);
  expect(JSON.stringify(result)).not.toContain(message);expect(result.providerCode).toBe('unrecognized');
});
it.each(fixtures)('rejects altered or sensitive variants for %s',async(_label,message)=>{
  for(const value of [message+' PRIVATE_SENTINEL@example.invalid','PRIVATE_SENTINEL '+message,message+'.',message+'\n',' '+message,message.toLowerCase(),message+' sk_test_PRIVATE_SENTINEL',message+' https://checkout.paystack.com/PRIVATE_SENTINEL']){
    expect(classifyValidationMessage(value)).toBeUndefined();
    const result=await inspect({message:value});expect(result).not.toHaveProperty('messageLabel');expect(JSON.stringify(result)).not.toContain('PRIVATE_SENTINEL');
  }
});
it.each([null,undefined,1,false,{},[],{message:'Email Address is required'},'unknown','x'.repeat(10000)])('ignores nonmatching input case %#',value=>{expect(classifyValidationMessage(value)).toBeUndefined();});
it('does not trust labels, nested messages or free-form field values supplied by the provider',async()=>{
  const result=await inspect({messageLabel:'email_invalid',data:{message:'Invalid Email Address Passed'},meta:{message:'Invalid Merchant Selected'}});
  expect(result).not.toHaveProperty('messageLabel');
  expect(safeProviderError({...result,messageLabel:'PRIVATE_SENTINEL' as any})).not.toHaveProperty('messageLabel');
});
it.each(['not-json','<html>PRIVATE_SENTINEL</html>','null','[]','"Email Address is required"'])('handles malformed or unexpected envelope case %#',async body=>{
  const result=await inspectProviderError(new Response(body,{status:400}),new AbortController().signal);
  expect(result.bodyState).toBe('malformed');expect(result).not.toHaveProperty('messageLabel');expect(JSON.stringify(result)).not.toContain('PRIVATE_SENTINEL');
});
it('emits only a fixed label in server diagnostics and performs one mocked request',async()=>{
  for(const[key,value]of Object.entries({HOST:'127.0.0.1',DATABASE_URL:'mysql://offline:unused@127.0.0.1:3307/southside_development',SOUTHSIDE_PAYMENTS_MODE:'test',PAYSTACK_TEST_NETWORK_APPROVED:'1',SOUTHSIDE_PHASE9_BASELINE_ID:'7',SOUTHSIDE_PAYSTACK_WEBHOOKS:'disabled',SOUTHSIDE_PAYSTACK_CALLBACK_MODE:'omit',PAYSTACK_SECRET_KEY:'sk_test_offline',PAYSTACK_PUBLIC_KEY:'pk_test_offline'}))vi.stubEnv(key,value);
  const warn=vi.spyOn(console,'warn').mockImplementation(()=>{}),message='Currency not supported by merchant';
  const fetch=vi.fn(async()=>new Response(JSON.stringify({message,type:'validation_error',code:'PRIVATE_SENTINEL',data:{email:'PRIVATE_SENTINEL@example.invalid',reference:'PRIVATE_SENTINEL',authorization:'sk_test_PRIVATE_SENTINEL'}}),{status:400}));vi.stubGlobal('fetch',fetch);
  await expect(provider().initialize({reference:'PRIVATE_SENTINEL',amount:'50000.00',currency:'NGN'} as any,'PRIVATE_SENTINEL@example.invalid','PRIVATE_SENTINEL')).rejects.toMatchObject({code:'SERVICE_UNAVAILABLE',diagnostic:{providerError:{providerCode:'unrecognized',messageLabel:'currency_not_enabled'}}});
  expect(fetch).toHaveBeenCalledTimes(1);expect(warn).toHaveBeenCalledTimes(1);
  const logs=JSON.stringify(warn.mock.calls);for(const value of [message,'PRIVATE_SENTINEL','sk_test_offline','pk_test_offline'])expect(logs).not.toContain(value);
});
