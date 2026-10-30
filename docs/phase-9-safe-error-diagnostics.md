# Phase 9: bounded provider error diagnostics

The approved diagnostic improvement is implemented and verified without a Paystack transaction API call, retry, external verification, database connection, migration, new booking/reference or financial write. Both unresolved attempts remain untouched by this work. Public documentation was consulted; no private keys were loaded. The operator-controlled application was not restarted.

## Behavior

Unsuccessful HTTP responses retain the existing `http_response` / `http_error` classification and numeric HTTP status. Before emitting that same safe failure, the adapter inspects a bounded response stream and adds a projected `providerError` summary:

```json
{
  "bodyState": "parsed",
  "providerCategory": "validation_error",
  "providerCode": "missing_params",
  "validationFields": ["amount"]
}
```

This is a fictional example, not a newly observed provider result. The existing operation, elapsed time, headers-received flag and allowlisted network codes remain available.

- Maximum inspected body: **8,192 bytes**, counted before decoding/JSON parsing. Oversized responses are discarded without parsing the partial body.
- Maximum inspection duration: **1,500 ms**, also bounded by the existing request abort signal. A stalled cancellation cannot keep the failure path open. No additional request is made.
- Fixed body outcomes: `parsed`, `empty`, `malformed`, `too_large`, `timeout`, `read_failed`, `unavailable`. HTTP status remains available even if inspection fails.
- Allowed provider categories: `api_error`, `validation_error`, `processor_error`.
- Initially allowed provider code: **`missing_params`**, explicitly illustrated in the [Paystack error reference](https://paystack.com/docs/api/errors/). Other codes/categories become the fixed label `unrecognized`; missing values become null. This is deliberately not an unrestricted provider-code logger. Additional codes require a reviewed allowlist change supported by documentation.
- Validation fields are exact matches against a fixed set of initialization parameter names. At most eight unique names are emitted. Only explicit `field`/`param`, `meta.field`, or bounded `errors` keys/entries are inspected. Those optional shapes are conservative extraction opportunities, not a claim that Paystack always supplies field details. No recursive search or message inference occurs.
- Provider messages, field values, arbitrary response objects, error causes, headers, guest information, credentials, booking/payment reference values, checkout URLs and card data are neither attached to the exception nor emitted to logs or database history. Raw bytes exist only transiently for bounded parsing. The diagnostic is server-side logging only; generic guest errors and existing attempt accounting remain unchanged.

For example, `reference` may appear as a validation **field name**, never its value. An unknown code containing a secret or URL becomes `unrecognized`. A provider returning only a free-form message will not reveal its specific reason through this diagnostic. This security limit is intentional.

## Metadata review and preserved behavior

The [initialization endpoint reference](https://paystack.com/docs/api/transaction/) specifies a stringified JSON metadata parameter. The [metadata guide](https://paystack.com/docs/payments/metadata/) illustrates a nested object. This discrepancy still does not prove why the second attempt received HTTP 400. Metadata formatting was **not changed**. Correct minor-unit string amounts, authentication construction, URL checks, fictional-only scope, test-key gates, disabled public webhooks, idempotency, reservation locking, settlement checks and manual confirmation rules remain unchanged.

The application still emits one initialization request and preserves uncertainty on failure. Error-body inspection does not retry, mark an attempt definitively failed, alter a booking balance or apply payment. Both existing unresolved attempts require continued preservation.

## Files changed

1. `server/payments/providerErrorBody.ts` — new bounded streaming inspection and strict projection.
2. `server/payments/paystack.ts` — unsuccessful-response inspection before the existing HTTP failure.
3. `server/payments/providerDiagnostics.ts` — optional reprojected provider-error summary in sanitized diagnostics.
4. `server/payments/providerErrorBody.test.ts` — 17 new offline cases covering projection, documented categories, unknown/missing fields, malicious text, malformed/scalar JSON, empty/oversized bodies, byte limits, field-count bounds, cancellation, deadlines, read failures and HTTP 400 integration.
5. `server/payments/providerDiagnostics.test.ts` — updated assertions for the optional summary and unavailable response streams.
6. This report.

Generated `dist` artifacts were rebuilt. No frontend source, schema, dependencies, lockfile, environment configuration, staff credentials or roles changed.

## Commands and executed results

From the nested project, using the existing pinned package manager:

```powershell
$env:COREPACK_HOME=Join-Path (Get-Location) '.corepack'
corepack pnpm exec vitest run server/payments/providerErrorBody.test.ts server/payments/providerDiagnostics.test.ts server/payments/paystack.test.ts server/payments/initialization-audit.test.ts server/payments/initialization-contract-review.test.ts server/payments/service.test.ts server/payments/testGuard.test.ts
corepack pnpm check
corepack pnpm build
```

- Relevant automated tests: **107 passed, seven files**. Existing successful initialization, exact amount, safe checkout URL, timeout, redaction, database-ownership guards and duplicate-payment regressions passed alongside the new cases. Transport and database ownership are mocked in adapter tests; no provider connection or development record is used.
- TypeScript: **passed**, exit 0.
- Production build: **passed**, exit 0. Existing non-module platform-script and large-chunk warnings remain. Frontend asset name remains `index-DuleuKRL.js`; no design changes were made.
- Full suite and real database integration suite were **not run** for this diagnostic-only stage; no database record verification is claimed as newly executed.

## Remaining uncertainty and next step

The historical first and second rejection reasons remain unknown: their discarded error bodies cannot be reconstructed by new code. No actual provider body was used to validate the new projection. Mock coverage proves bounded extraction and redaction, not that a future provider response will include a useful allowlisted code or explicit field.

The rebuilt guarded application contains the change, but the existing private server process has not been restarted and may still run the prior build. Before any separately approved test, close old payment-return tabs, restart through the existing private guarded launcher and repeat runtime security checks. Do not retry either unresolved initialization. Any new booking/reference, external verification or controlled transaction requires its own explicit approval after this report. No such approval is presumed or requested as part of implementation. Live payments, production access, deployment and public webhooks remain excluded.
