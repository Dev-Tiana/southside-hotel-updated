# Phase 9 corrective stage: diagnostics and amount serialization

The approved corrections are implemented and verified offline and against the isolated integration database. **No Paystack API request, initialization retry, checkout or new development reservation/payment reference was initiated.** No migration, dependency installation, credential change, public webhook or deployment occurred. The built application was not started/restarted by this stage.

## Implemented changes

`server/payments/providerDiagnostics.ts` provides typed, sanitized provider failures. Each failure emits one server-side `[Paystack]` JSON log containing only:

- operation (`initialize` or `verify`);
- fixed stage/category;
- elapsed milliseconds;
- whether HTTP headers were received;
- HTTP status, when known;
- a small allowlist of network/TLS codes.

No original exception/cause, API key, Authorization header, guest identity/email, amount, currency, booking/payment reference, checkout/access URL, card data or provider body is attached or logged. Unknown network codes are discarded. HTTP error bodies are not read for diagnostics. Generic guest-facing service-unavailable messages remain unchanged.

| Failure | Internal stage/category |
| --- | --- |
| DNS, TLS, connection/reset failure | `request` / `connection_failure` |
| Request deadline/connect/header timeout | `request` / `request_timeout` |
| Timeout after headers while reading the body | `response_body` / `response_body_timeout` |
| Other response-read failure | `response_body` / `response_body_failure` |
| Non-2xx status | `http_response` / `http_error`, with numeric HTTP status |
| Invalid JSON | `json_parsing` / `json_parse_error` |
| Unsafe unsigned provider-ID JSON value | `json_parsing` / `json_value_error` |
| Oversize body or invalid provider envelope | `response_too_large` or `provider_response_error` |
| Missing/malformed/untrusted hosted URL | `checkout_url_missing`, `checkout_url_invalid` or `checkout_url_rejected` |
| Wrong echoed reference | `reference_validation` / `reference_mismatch` |
| Other preflight/response validation failure | Fixed database/configuration/callback/transaction validation category |

The adapter now serializes initialization amount with `cents(a.amount).toString()`. A saved **NGN 50,000.00** balance produces JSON **`"amount":"5000000"`**, retaining exact minor units and the existing server-authoritative value. This follows the [Paystack initialization contract](https://paystack.com/docs/api/transaction/). Existing currency, references, callback and metadata bindings are retained. Metadata serialization was not changed as part of the amount-only correction.

The ten-second request deadline, HTTPS API host, redirect rejection, strict hosted-URL allowlist, database/test gates, unsigned-ID handling, administrator authorization and all settlement guards remain in force. No timeout extension, proxy/TLS change, automatic retry or extra external request was added.

## Record and behavior preservation

The runtime payment service and repository were not modified. They continue to preserve an ambiguous initialization as one unresolved attempt. Retries reuse the original attempt; they do not create a replacement provider initialization. Success still requires authoritative reference/amount/currency/domain/metadata/balance checks and transactional ledger/audit persistence. Payment does not automatically confirm a reservation.

Diagnostics are **process logs only**. They do not append/backfill database events or modify the original attempt's historical diagnostic code. Typed failures retain the same safe TRPC error code/message, and the existing service catches them without changing its accounting behavior.

A stricter corrective-stage preservation snapshot was captured before integration testing. It includes every development reservation/guest/rate/inventory/history/payment/audit row, booking submissions/notifications, payment attempts/events and staff identity/role/enabled metadata. The comparison checks both row hashes and membership, so additional/deleted rows fail the check. After all tests, the comparison **passed**.

The original development booking remains:

| Field | Final verified value |
| --- | --- |
| Booking | `SSFICTIONAL09`, reservation 8 |
| Status | `pending manual confirmation` |
| Total | NGN 50,000.00 |
| Amount paid | NGN 0.00 |
| Outstanding | NGN 50,000.00 |
| Attempts/payment rows | **1 existing attempt / 0 payment rows** |
| Existing attempt state | `pending`, `initialization_uncertain`, no checkout URL |

No development booking, reference, payment or financial-history row was added or changed. Real MySQL tests used fresh fictional fixtures and mock providers in **southside_integration**, never the development booking. Administrator setup was intentionally excluded. Test fixture records are not historical customer records and are not destructively cleaned up.

## Historical evidence and remaining uncertainty

Available historical evidence was inspected locally without another provider call:

- the original attempt's previously recorded ten-second interval and generic uncertainty;
- the saved first-transaction plan/result;
- `.local/phase9-verification-diagnostic.json`: the earlier, separately approved single GET returned HTTP 400, `transaction_reference_not_found`, in 1,079 ms, with no local financial changes.

No original initialization HTTP status, error code, response-stage trace or provider request identifier was retained. No additional historical Test-mode dashboard export/provider log was available locally. The new diagnostics cannot reconstruct a past discarded exception or prove that the amount's former numeric serialization caused it. The original state remains unestablished; a timeout remains consistent with the timing but is not proven as the precise cause.

Recommended next step: privately check the correct Paystack Test-mode dashboard/provider logs for the existing reference and time window. Review this correction before any separate approval for an instrumented fictional transaction. Do not clear the existing uncertainty, resend initialization, weaken validation or manually adjust balances based only on the not-found lookup. **No new transaction approval is requested by this report.**

## Commands actually executed and results

All package commands used the existing pinned pnpm installation; no lockfile or package changes were made.

```powershell
$env:COREPACK_HOME = Join-Path (Get-Location) '.corepack'
corepack pnpm exec vitest run server/payments/initialization-audit.test.ts server/payments/paystack.test.ts server/payments/providerDiagnostics.test.ts server/payments/service.test.ts server/payments/testGuard.test.ts
corepack pnpm check
node scripts/local/phase7-preservation.mjs --phase9-correction --capture
corepack pnpm test
node scripts/local/test.mjs --preserve-administrator
corepack pnpm build
node scripts/local/phase7-preservation.mjs --phase9-correction
```

| Check | Executed result |
| --- | --- |
| Relevant offline payment tests | **84 passed**, 5 files |
| Complete automated suite | **252 passed, 52 skipped**, 23 passing files and 3 database-only files skipped |
| Real MySQL integration suite | **51 passed, 1 intentionally skipped**, 3 passing files; no external fetch calls in payment integration tests |
| TypeScript | **Passed** `tsc --noEmit` |
| Production build | **Passed** Vite/esbuild; existing non-module platform-script and large-bundle warnings remain nonfatal |
| Corrective-stage development preservation | **Passed**, including the unresolved Phase 9 booking and all attempt/event/ledger records |

New tests verify redaction, HTTP/network/JSON/checkout classifications, distinct pre-response and body-read deadlines, minor-unit string serialization, unchanged generic guest errors, and ambiguous-failure duplicate prevention. The additional real MySQL test injects a typed timeout and proves concurrent retries retain one attempt, one mock initialization invocation, zero payment rows and an unchanged fictional reservation. Existing concurrent settlement, authorization, mismatch, rollback and manual-confirmation tests also passed.

The extended preservation helper initially made a read-only query using an `id` column on `booking_submissions`; that table's primary key is `keyHash`. The helper was corrected, then capture and comparison passed. The failed query changed no data and required no schema/migration change. No test failures remain.

Ignored local logs: `.local/phase9-correction-targeted.log`, `phase9-correction-suite.log`, `phase9-correction-mysql.log`, `phase9-correction-typecheck.log`, `phase9-correction-build.log`. `.local/phase9-correction-baseline.json` stores private preservation fingerprints only. No raw provider response or credential was captured.

## Changed files

1. `server/payments/paystack.ts` — typed stage-specific failures, minor-unit amount string, unchanged verification/binding rules.
2. New `server/payments/providerDiagnostics.ts` — sanitized error class, fixed diagnostic fields and timeout classification.
3. New `server/payments/providerDiagnostics.test.ts` — stage/redaction regression coverage.
4. `server/payments/paystack.test.ts` — string amount expectation and updated diagnostic-test wording.
5. `server/payments/initialization-audit.test.ts` — corrected request expectation and distinct timeout assertions.
6. `server/payments/service.test.ts` — diagnosed ambiguous-timeout idempotency/accounting-preservation test.
7. `server/payments/mysql.integration.test.ts` — real transaction timeout/deduplication regression test.
8. `scripts/local/phase7-preservation.mjs` — exact corrective-stage development snapshot, including the proper submission primary key.
9. New `docs/phase-9-corrective-stage.md` — implementation, evidence, test commands and remaining uncertainty.
10. `docs/phase-9-root-cause-review.md` — link to this implemented correction, preserving the historical review.

Generated `dist` output and ignored local test evidence are additional artifacts. No client design/content/navigation, database schema, staff credentials/roles, payment reference, payment business rule, production configuration or public endpoint was changed. This stage did not launch the corrected build or exercise it against Paystack; any future provider test still needs separate approval.
