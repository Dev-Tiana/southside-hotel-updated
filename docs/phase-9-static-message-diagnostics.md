# Phase 9: static-message diagnostics and private provider investigation

## Implemented scope

Implemented the approved diagnostic-only change. No initialization payload, callback mode, metadata representation, booking logic, authorization or payment accounting was modified. No database connection/write, Paystack API request, booking creation, retry, server restart or existing diagnostic-record update occurred. All four historical attempts and financial records remain untouched. Public documentation was consulted without signing in to Paystack or accessing credentials.

## Exact-match classifier

New `server/payments/validationMessage.ts` maps seven exact documented static messages to six fixed local labels: `amount_invalid`, `email_invalid`, `merchant_disabled`, `reference_invalid`, `email_missing`, `currency_not_enabled`. Sources are linked in the module: [transaction errors](https://paystack.com/docs/api/errors/transaction/), [generic errors](https://paystack.com/docs/api/errors/) and [charge errors](https://paystack.com/docs/api/errors/charge/).

The existing bounded error-body inspector classifies only the top-level `message` in transient memory. A recognized message adds optional `messageLabel` to its safe summary; this is a **local classification**, not a Paystack error code or confirmed root cause. The summary is reprojected through an exact fixed-label allowlist before server logging. Unknown labels supplied in a provider body are ignored. Unrecognized or absent messages add no label.

There is no lowercasing, trimming, punctuation removal, substring matching, regex extraction or interpolation. Inputs longer than 160 characters or non-string inputs do not match. Unknown messages, nested prose, arbitrary field values and known-message prefixes/suffixes are not retained. Existing 8 KiB body limit, 1.5-second diagnostic deadline, request deadline, eight-field cap, reviewed code allowlist and generic guest-facing errors remain unchanged. Raw messages, response bodies, request details, credentials, customer information, reference values and checkout URLs are not emitted or persisted by this addition. The static strings in source/tests are public documentation fixtures, not retained runtime provider responses.

The classifier never triggers retries, changes attempt state or drives settlement. Historical diagnostic rows/files were not backfilled. A label only describes a matching provider statement and is not proof of the underlying cause. For example, provider support must resolve account-specific reasons even if a merchant-related label is observed.

## Changed files

1. `server/payments/validationMessage.ts` — new exact static-message mapping and safe-label projection.
2. `server/payments/providerErrorBody.ts` — optional classification during bounded parsing and allowlisted reprojection.
3. `server/payments/validationMessage.test.ts` — 30 offline tests for all documented fixtures, sensitive additions, case/whitespace/punctuation changes, unknown/non-string inputs, malformed envelopes, untrusted labels/nested messages and integrated redacted logging.
4. This report.

No frontend, database schema, dependency, lockfile, launcher, private configuration or financial record changed.

## Verification actually executed

```powershell
$env:COREPACK_HOME=Join-Path (Get-Location) '.corepack'
corepack pnpm exec vitest run server/payments/validationMessage.test.ts server/payments/providerErrorEvidence.test.ts server/payments/providerErrorBody.test.ts server/payments/providerDiagnostics.test.ts server/payments/callbackOmission.test.ts server/payments/initialization-contract-review.test.ts server/payments/initialization-audit.test.ts server/payments/paystack.test.ts server/payments/service.test.ts server/payments/testGuard.test.ts
corepack pnpm check
```

Offline tests: **164 passed, ten files**, including 30 new classifier cases. TypeScript: **passed**, exit 0. Adapter transport and database ownership are mocked; accounting regressions use an in-memory repository. No real MySQL test, production build or browser/provider test was run. No new database preservation comparison is claimed; preservation follows from no database access/write during this change.

## Remaining limitations

This cannot recover the unknown messages/codes discarded by any previous attempt. Provider wording, punctuation or capitalization changes deliberately fail to unknown. The list is intentionally incomplete; documented charge messages may never appear on initialization. Provider acceptance and the exact historical HTTP 400 cause remain unverified. The source is verified, but `dist` was not rebuilt and the private server was not restarted; the new classifier is **not claimed active** in the current runtime. Any activation requires a later approved build/restart, not another transaction as part of this implementation.

## Privately check NGN eligibility — read only

1. Sign in directly to your Paystack dashboard privately and select the same business/integration used when the encrypted development credentials were configured. Keep **Test Mode** selected. Do not reveal, copy into chat, rotate or replace keys.
2. Inspect the business profile/settings country and any displayed account/payment currency information. Navigation varies; the [new dashboard navigation guide](https://support.paystack.com/en/articles/9040258) documents Settings and Developers. Do not change country, currencies, callback, key/IP settings, payment channels or compliance information.
3. [Paystack's currency table](https://paystack.com/docs/api/) lists NGN availability for Nigeria. [Currency-error guidance](https://support.paystack.com/en/articles/2129794) explains that the requested currency must be enabled for the business and the default follows its country. A Nigerian business is consistent with NGN support but is not proof every test integration is enabled; Test Mode alone is insufficient. Do not assume that international-payment acceptance or a settlement account denominated in NGN establishes transaction-currency eligibility.
4. If no explicit eligibility information is shown, ask Paystack support to confirm that **this business's test integration can initialize transactions with currency NGN**. There is no universally documented dashboard NGN toggle to instruct you to enable. Do not activate live mode, change currencies or send a test transaction to discover this.
5. Any response you choose to share in chat should contain only non-sensitive conclusions such as “NGN enabled” or “support confirmed a currency restriction”; no account screenshots, keys or guest records are needed.

## Contact support about the existing rejection

Use Help/Support inside your authenticated dashboard or the contact route linked by the official [Paystack support article](https://support.paystack.com/en/articles/2129794). Do not send new requests through API playgrounds or initialize another payment. No message was sent by this work.

Suggested private support text:

> Our development integration in Test Mode received HTTP 400 with type validation_error when calling POST /transaction/initialize. The saved amount is NGN 50,000, serialized as the minor-unit string 5000000. The per-request callback was omitted, the Test Mode dashboard callback is blank, and metadata was a JSON object containing booking/attempt bindings. Our logs intentionally suppressed the unknown provider code and raw message. Please trace the existing failed request, identify the exact validation code and offending parameter name, and confirm whether this test integration is eligible for NGN. Please do not create, retry or charge a transaction.

Privately supply the existing fourth attempt's reference and approximate timestamp **with its timezone** only through Paystack's official support channel if needed for correlation. Retrieve these from your existing private local audit evidence; do not run an initializer or verification helper to obtain them. Do not paste audit files wholesale: include only the necessary correlation fields and sanitized diagnostic. Never send API keys, authorization headers, passwords, cookie/session data, raw provider bodies or customer records. If a timestamp is uncertain, state the time window rather than converting an unspecified host timestamp incorrectly.

The new dashboard documents [webhook delivery history](https://support.paystack.com/en/articles/10609026), not a guaranteed archive of rejected initialization POSTs. Ask whether request/error logs are available for your integration. Do not enable or retry webhooks. Support's confirmation of a code/field or NGN eligibility should guide the next correction; another checkout is not authorized or recommended by this report.
