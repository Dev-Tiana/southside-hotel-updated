// Offline evidence/redaction regressions, including the approved code expansion.
import {expect,it} from 'vitest';
import {inspectProviderError,safeProviderError} from './providerErrorBody';
const inspect=(body:unknown)=>inspectProviderError(new Response(JSON.stringify(body),{status:400}),new AbortController().signal);
it('proves the retained third-attempt projection cannot recover a unique code',async()=>{
  const first=await inspect({type:'validation_error',code:'OFFLINE_CANDIDATE_A',message:'PRIVATE_A'});
  const second=await inspect({type:'validation_error',code:'OFFLINE_CANDIDATE_B',message:'PRIVATE_B'});
  expect(first).toEqual(second);
  expect(first).toEqual({bodyState:'parsed',providerCategory:'validation_error',providerCode:'unrecognized',validationFields:[]});
  expect(safeProviderError(first)).toEqual(first);
});
it.each([17,false,{},[]])('unrecognized does not prove a string code was received: %j',async code=>{
  expect((await inspect({type:'validation_error',code})).providerCode).toBe('unrecognized');
});
it('distinguishes accepted missing_params from missing/null codes',async()=>{
  expect((await inspect({code:'missing_params'})).providerCode).toBe('missing_params');
  expect((await inspect({})).providerCode).toBeNull();
  expect((await inspect({code:null})).providerCode).toBeNull();
});
it.each(['not_found','rate_limited'])('retains reviewed documented code %s without inferring its relevance to initialization',async code=>{
  expect((await inspect({code,type:code==='rate_limited'?'api_error':'validation_error'})).providerCode).toBe(code);
});
it('does not infer a validation field from message text, nested values or undocumented shapes',async()=>{
  const result=await inspect({type:'validation_error',code:'OFFLINE_UNKNOWN',message:'Email Address is required',meta:{nextStep:'PRIVATE_VALUE',param:'email'},data:{field:'email'}});
  expect(result.validationFields).toEqual([]);
  expect(JSON.stringify(result)).not.toContain('PRIVATE_VALUE');
  expect(JSON.stringify(result)).not.toContain('Email Address');
});
it('documented generic error example need not provide explicit validation fields',async()=>{
  const result=await inspect({type:'validation_error',code:'missing_params',message:'Email Address is required',meta:{nextStep:'Provide all required params'}});
  expect(result.providerCode).toBe('missing_params');expect(result.validationFields).toEqual([]);
});
