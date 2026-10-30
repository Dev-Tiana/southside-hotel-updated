// Only exact documented static text is examined. No normalization, values,
// substrings, regex captures or provider text may leave this module.
// https://paystack.com/docs/api/errors/transaction/
// https://paystack.com/docs/api/errors/
// https://paystack.com/docs/api/errors/charge/
const messages=new Map<string,ValidationMessageLabel>([
  ['You must specify a valid amount','amount_invalid'],
  ['Invalid Email Address Passed','email_invalid'],
  ['Invalid Merchant Selected','merchant_disabled'],
  ['Invalid character in transaction reference','reference_invalid'],
  ['Email Address is required','email_missing'],
  ['Amount must be an integer','amount_invalid'],
  ['Currency not supported by merchant','currency_not_enabled'],
]);
export type ValidationMessageLabel='amount_invalid'|'email_invalid'|'merchant_disabled'|'reference_invalid'|'email_missing'|'currency_not_enabled';
const labels=new Set<ValidationMessageLabel>(messages.values());
export function classifyValidationMessage(value:unknown):ValidationMessageLabel|undefined{
  return typeof value==='string'&&value.length<=160?messages.get(value):undefined;
}
export function safeValidationMessageLabel(value:unknown):ValidationMessageLabel|undefined{
  return typeof value==='string'&&labels.has(value as ValidationMessageLabel)?value as ValidationMessageLabel:undefined;
}
