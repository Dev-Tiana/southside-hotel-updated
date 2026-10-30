import {TRPCError} from "@trpc/server";
import {safeProviderError,type ProviderErrorSummary} from './providerErrorBody';

export type ProviderOperation="initialize"|"verify";
export type ProviderStage="configuration"|"database_guard"|"callback_validation"|"request"|"http_response"|"response_body"|"json_parsing"|"response_validation"|"checkout_validation"|"reference_validation"|"transaction_validation";
export type ProviderCategory="configuration_disabled"|"database_guard_failed"|"callback_url_invalid"|"connection_failure"|"request_timeout"|"http_error"|"response_body_timeout"|"response_body_failure"|"response_too_large"|"json_parse_error"|"json_value_error"|"provider_response_error"|"checkout_url_missing"|"checkout_url_invalid"|"checkout_url_rejected"|"reference_mismatch"|"invalid_transaction_response";
export type ProviderContext={operation:ProviderOperation;started:number;headersReceived:boolean;httpStatus?:number;providerError?:ProviderErrorSummary};
const networkCodes=new Set(["ENOTFOUND","EAI_AGAIN","ECONNREFUSED","ECONNRESET","ETIMEDOUT","UND_ERR_CONNECT_TIMEOUT","UND_ERR_HEADERS_TIMEOUT","UND_ERR_BODY_TIMEOUT","CERT_HAS_EXPIRED","UNABLE_TO_GET_ISSUER_CERT_LOCALLY","UNABLE_TO_VERIFY_LEAF_SIGNATURE","ERR_TLS_CERT_ALTNAME_INVALID","DEPTH_ZERO_SELF_SIGNED_CERT","SELF_SIGNED_CERT_IN_CHAIN"]);
export function providerContext(operation:ProviderOperation):ProviderContext{return{operation,started:Date.now(),headersReceived:false};}
export function providerTimedOut(error:unknown,signal:AbortSignal){
  const e=error as any;
  return(signal.aborted&&signal.reason?.name==="TimeoutError")||e?.name==="TimeoutError"||[e?.code,e?.cause?.code].some(code=>["ETIMEDOUT","UND_ERR_CONNECT_TIMEOUT","UND_ERR_HEADERS_TIMEOUT","UND_ERR_BODY_TIMEOUT"].includes(code));
}
export class PaymentProviderFailure extends TRPCError{
  readonly diagnostic;
  constructor(context:ProviderContext,stage:ProviderStage,category:ProviderCategory,error?:unknown){
    super({code:"SERVICE_UNAVAILABLE",message:"Test payments are disabled or the provider is unavailable. No live payments are supported."});
    const e=error as any,children=Array.isArray(e?.cause?.errors)?e.cause.errors.slice(0,3):[];
    const codes=[e?.code,e?.cause?.code,...children.map((child:any)=>child?.code)].filter(code=>typeof code==="string"&&networkCodes.has(code));
    // Strict projection: never attach the exception, request, URL, body, key,
    // reference, amount, guest identity or arbitrary provider text.
    this.diagnostic=Object.freeze({operation:context.operation,stage,category,elapsedMs:Math.max(0,Date.now()-context.started),headersReceived:context.headersReceived,httpStatus:context.httpStatus??null,networkCodes:[...new Set<string>(codes)],...(context.providerError?{providerError:safeProviderError(context.providerError)}:{})});
    console.warn("[Paystack]",JSON.stringify(this.diagnostic));
  }
}
export function providerFailure(context:ProviderContext,stage:ProviderStage,category:ProviderCategory,error?:unknown):never{throw new PaymentProviderFailure(context,stage,category,error);}
