// No free-form provider text, field values, headers or response bodies leave
// this module. Codes must be reviewed against provider documentation first.
import {classifyValidationMessage,safeValidationMessageLabel,type ValidationMessageLabel} from './validationMessage';
const categories=new Set(['api_error','validation_error','processor_error']);
// Documented generic tokens; not_found's example is on a different endpoint
// and does not prove it can explain an initialization rejection.
// https://paystack.com/docs/api/errors/
// https://paystack.com/docs/api/virtual-terminal/
// https://paystack.com/docs/api/rate-limits/
const codes=new Set(['missing_params','not_found','rate_limited']);
const fields=new Set(['email','amount','currency','reference','callback_url','metadata','channels','plan','invoice_limit','split_code','subaccount','transaction_charge','bearer']);
export type ErrorBodyState='parsed'|'empty'|'malformed'|'too_large'|'timeout'|'read_failed'|'unavailable';
export type ProviderErrorSummary={bodyState:ErrorBodyState;providerCategory:string|null;providerCode:string|null;validationFields:string[];messageLabel?:ValidationMessageLabel};
const states=new Set<ErrorBodyState>(['parsed','empty','malformed','too_large','timeout','read_failed','unavailable']);
const known=(value:unknown,allow:Set<string>)=>typeof value==='string'&&allow.has(value)?value:value==null?null:'unrecognized';
export function safeProviderError(value:ProviderErrorSummary):ProviderErrorSummary{
  const messageLabel=safeValidationMessageLabel(value.messageLabel);
  return {bodyState:states.has(value.bodyState)?value.bodyState:'malformed',providerCategory:known(value.providerCategory,categories),providerCode:known(value.providerCode,codes),validationFields:[...new Set(value.validationFields.filter(v=>fields.has(v)))].slice(0,8),...(messageLabel?{messageLabel}:{})};
}
function summary(bodyState:ErrorBodyState):ProviderErrorSummary{return{bodyState,providerCategory:null,providerCode:null,validationFields:[]};}
function project(body:unknown):ProviderErrorSummary{
  if(!body||typeof body!=='object'||Array.isArray(body))return summary('malformed');
  const o=body as any,candidates:unknown[]=[o.field,o.param,o.meta?.field];
  // These optional shapes are recognized conservatively; they are not claims
  // that Paystack always returns field-level details. Never inspect values.
  if(Array.isArray(o.errors))for(const error of o.errors.slice(0,16))candidates.push(error?.field,error?.param);
  else if(o.errors&&typeof o.errors==='object')candidates.push(...Object.keys(o.errors).slice(0,32));
  return safeProviderError({bodyState:'parsed',providerCategory:known(o.type,categories),providerCode:known(o.code,codes),validationFields:candidates.filter((v):v is string=>typeof v==='string'&&fields.has(v)),messageLabel:classifyValidationMessage(o.message)});
}
export async function inspectProviderError(response:Response,parentSignal:AbortSignal):Promise<ProviderErrorSummary>{
  let reader:ReadableStreamDefaultReader<Uint8Array>|undefined,timer:ReturnType<typeof setTimeout>|undefined;
  let onAbort:()=>void=()=>{},deadlineReached=false;
  try{
    if(!response.body||typeof response.body.getReader!=='function')return summary('unavailable');
    reader=response.body.getReader();
    const stopped=new Promise<never>((_,reject)=>{
      onAbort=()=>{deadlineReached=true;reject(new Error('diagnostic deadline'));};
      timer=setTimeout(onAbort,1500);
      parentSignal.addEventListener('abort',onAbort,{once:true});
      if(parentSignal.aborted)onAbort();
    });
    const chunks:Uint8Array[]=[];let bytes=0;
    while(true){
      let item:ReadableStreamReadResult<Uint8Array>;
      try{item=await Promise.race([reader.read(),stopped]);}
      catch{return summary(deadlineReached||parentSignal.aborted?'timeout': 'read_failed');}
      if(item.done)break;
      bytes+=item.value.byteLength;if(bytes>8192)return summary('too_large');
      chunks.push(item.value);
    }
    if(!bytes)return summary('empty');
    const buffer=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.byteLength;}
    try{return project(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(buffer)));}
    catch{return summary('malformed');}
  }catch{return summary('read_failed');}
  finally{
    if(timer)clearTimeout(timer);parentSignal.removeEventListener('abort',onAbort);
    // Cancellation must not itself hold the payment failure path open.
    if(reader)void reader.cancel().catch(()=>{});
  }
}
