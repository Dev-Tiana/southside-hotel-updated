# Phase 9: fourth initialization validation review

## Conclusion and preservation

The exact rejected field remains unidentified. The fourth attempt received HTTP 400 with provider category `validation_error`, but the code was projected to `unrecognized` and no recognized explicit field survived. Callback omission was not sufficient to obtain successful initialization. This does not identify metadata, email or account configuration as the cause.

This investigation used source files, existing sanitized local evidence and public documentation only. No runtime code, configuration, server process, booking, attempt or financial record was changed. No database connection, dashboard login, Paystack API request, retry, verification or new booking occurred. All four attempts remain untouched. No fresh database preservation comparison or automated test/build is claimed in this source-review stage. The only new file is this report.

## Complete request review

| Field | Actual construction | Assessment |
| --- | --- | --- |
| Endpoint/method | HTTPS `api.paystack.co/transaction/initialize`, POST, JSON body | Matches the documented backend endpoint. No alternate test hostname is required; test keys select test behavior. No redirect or TLS bypass is enabled. |
| Authorization | Documented Bearer scheme using the server test secret; JSON content type | Correct construction. Public key is not used for backend authentication. Prefix checks do not prove account ownership or key validity. No key was inspected. |
| Email | Saved fictional email, string, using the reserved fictional domain required by our guard | Present and syntactically email-shaped. Provider acceptance of that reserved domain is unknown. Paystack documents invalid-email rejection but does not establish that this fixture caused it. Do not substitute real guest details or weaken the guard on a guess. |
| Amount | Saved outstanding balance converted with `cents(...).toString()` | Correct positive integer string `5000000` for NGN 50,000. No browser total is trusted. The prior numeric-type discrepancy is corrected. |
| Currency | Explicit string `NGN` | Valid currency code, but merchant/country eligibility is separate. Dashboard Test Mode does not prove this account supports NGN. |
| Reference | Server-generated `SST-` plus hexadecimal UUID, unique local constraint | Matches the allowed alphabet. Booking references are separate metadata values, not this field. No reference was generated during review. |
| Metadata | Nested object with `booking_reference` and `attempt_reference`, both strings | Endpoint table specifies stringified JSON, while official metadata examples use an object. This is a documentation discrepancy, not proof of an invalid request. Whole-body JSON serialization does not turn nested metadata into a JSON string. |
| Callback | Property omitted under the explicit guarded test switch; owner reported blank dashboard fallback | Omission is documented. Fourth failure shows that removing the per-request callback did not suffice; it does not prove historical callback acceptance or another field's cause. |
| Other fields | No plan, subaccount, split, card details or browser payment result | No unused-feature conditional parameter is demonstrably missing. No payment channel is explicitly forced. |

Sources: [transaction initialization contract](https://paystack.com/docs/api/transaction/), [authentication](https://paystack.com/docs/api/authentication/), [metadata guide](https://paystack.com/docs/payments/metadata/), [supported currencies](https://paystack.com/docs/api/) and [transaction errors](https://paystack.com/docs/api/errors/transaction/).

No retained wire-body capture exists, so this is the actual source-construction path supported by earlier mocked request tests, not an independently captured historical HTTP payload. The server's saved balance and nightly snapshot were checked before the controlled attempt as documented in its result report.

## Diagnostics: what was lost and what can safely improve

The approved body inspector reads at most 8 KiB within 1.5 seconds and the request deadline. It retains the provider type only if allowlisted, code only if exactly `missing_params`, `not_found` or `rate_limited`, and at most eight safe field names from selected structured properties. It ignores `message`, `meta.next_step`/`nextStep`, arbitrary nested values and unrecognized code values. These privacy choices explain the lack of a specific reason despite successful JSON parsing.

The fourth `unrecognized` code cannot be reconstructed: many strings and unexpected non-string values have the same retained projection. The original lookup's locally assigned not-found category is not the fourth provider code. No raw historical body or dashboard error export is available in inspected files.

The smallest useful diagnostic proposal is an exact-match classifier for a short reviewed set of **documented static messages**, outputting only fixed local labels, for example missing-email, invalid-email, invalid-amount, invalid-reference, merchant-disabled or currency-not-enabled. Use exact bounded comparisons, not wildcard extraction or logging of matched messages. Label the output as a local classification, never a provider code. Keep unknown text suppressed, existing limits and all settlement rules unchanged. Add adversarial offline tests showing appended guest details, URLs, references or secrets do not match and are never logged. This is not implemented; it would help only a future response or an existing response that the owner can privately obtain, not recover discarded bytes.

Expanding arbitrary identifier-shaped codes is not recommended because secrets/references can fit identifier alphabets. Adding more unrelated endpoint codes is unlikely to identify this specific error. Existing categories are already documented and retained. See [Paystack error structure](https://paystack.com/docs/api/errors/) and [transaction error descriptions](https://paystack.com/docs/api/errors/transaction/).

## Existing dashboard history: what is documented

The [new dashboard navigation guide](https://support.paystack.com/en/articles/9040258) documents Developers and Audit logs, but does not establish that rejected initialization request bodies are available there. The [webhook history guide](https://support.paystack.com/en/articles/10609026) explicitly documents **Developers → Webhooks** with Test Mode event delivery history and request/response inspection. Those records concern Paystack's outbound webhook deliveries, not our inbound initialization request. Webhooks remain disabled; do not configure one or retry an event to investigate this failure.

I could not confirm from reviewed official documentation a universally available Test Mode HTTP API request/error-history screen covering rejected initialization POSTs. Do not assume such a screen exists or that absence from Transactions proves no request arrived. Privately inspect Developers for any request-log tooling available to your account, using existing records only. If absent, contact normal Paystack technical support through the dashboard Help/Support route and ask whether they can trace the existing failed initialization. No support message has been sent by this investigation.

Use the existing attempt reference/time window privately for support correlation; do not paste raw responses, keys, authorization headers or customer records into chat. Ask for the exact validation code/parameter and a non-sensitive description. Avoid invoking AI dashboard commands that might perform actions. No API calls, webhook retries or transaction reinitialization are needed for this request for historical evidence.

## Account/currency questions

Paystack's [system-error guidance](https://support.paystack.com/en/articles/2129794) explains that currencies must be enabled for the business and that default currency follows business country. [Supported currency documentation](https://paystack.com/docs/api/) lists NGN availability for Nigeria. Check privately, without changing settings: the business selected by the saved test key, its country, NGN eligibility, business-enabled status and any API IP allowlist. Dashboard Test Mode establishes environment selection, not those properties.

The [transaction error guide](https://paystack.com/docs/api/errors/transaction/) documents disabled-merchant and invalid-email failures. [Authentication guidance](https://paystack.com/docs/api/authentication/) describes test-key separation and optional IP restrictions. No retained evidence proves one applies. Missing/invalid authentication normally gives 401; the observed validation category makes request/account validation the stronger class, but does not prove authentication succeeded. Live activation, key rotation or a currency change is not justified by this evidence.

## Most plausible causes versus confirmed defects

1. **Merchant/currency eligibility or other integration validation:** explicit NGN may be unavailable for the selected business. This is a concrete account prerequisite, but the business country/eligibility has not been inspected.
2. **Email validation:** the deliberately non-deliverable fixture domain may face provider validation. Documentation establishes email validation exists, not that this domain was rejected.
3. **Metadata representation:** canonical stringification would align the endpoint table, but official object examples prevent treating it as a proven fix. No valid-response parser/checkout bug is demonstrated by an HTTP rejection before that stage.

These are investigation priorities, not a defensible probability ranking between fields. The only confirmed application limitation is loss of diagnostic specificity through deliberate redaction. There is **no confirmed payment-payload defect causing the fourth rejection**. No correction to payment behavior should be presented as proven.

## Recommended next step and proposed correction

First obtain existing provider evidence and privately check merchant NGN eligibility. If this identifies a field, propose the smallest targeted change and explain risks before implementation. Do not launch a fifth test to guess between fields.

If existing provider evidence is unavailable, request approval for the fixed-label message classifier and offline tests only; do not bundle another transaction or restart. The risk is incorrect attribution if provider wording changes, so exact matching must fail to unknown, remain diagnostic-only and never drive balances or statuses. A later metadata stringification proposal must preserve both binding values and authoritative verification, and requires its own review; it is not recommended as the first blind fix. No callback, currency, email, credential, financial or public-exposure change is approved by this report.

All four attempts and financial records remain preserved by this read-only investigation. Live payments, production access and public webhooks remain disabled under the existing guarded configuration. No further authorization is presumed.
