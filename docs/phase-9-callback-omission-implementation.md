# Phase 9: approved local callback omission implemented

Implemented the approved narrow local change and verified it offline. No server restart, Paystack transaction API call, external verification, database connection/write, new booking/reference, migration, dashboard modification, public endpoint or deployment occurred. All three unresolved bookings, payment attempts, staff accounts and financial history remain untouched by this work. No credentials were loaded or displayed.

## Runtime changes

`SOUTHSIDE_PAYSTACK_CALLBACK_MODE` now accepts:

- Unset or `return`: existing callback construction/validation and request property remain unchanged.
- `omit`: the real test adapter does not construct or send `callback_url`. The JSON property is absent, not empty or null.
- Any other explicit value: test payments are disabled before provider initialization/attempt creation through the normal service path.

The guarded launcher explicitly forces `omit` in its private child environment. All existing owned-development-database, test-key, fictional-booking, loopback, disabled-public-webhook and financial safeguards remain mandatory. Mock payments keep their existing behavior. Staff authentication origin/cookie settings are unchanged; skipping unused payment callback construction does not disable staff-origin checks.

Initialization still uses the saved server balance as a string of minor units. Currency, reference, object metadata, response/reference validation, strict HTTPS checkout allowlist, deadlines, uncertainty preservation and no-auto-retry behavior remain unchanged.

## Manual return, recovery and integrity

The owner has confirmed the Test Mode dashboard callback is blank. Under [Paystack's documented omission behavior](https://paystack.com/docs/payments/accept-payments/), no automatic browser return is expected when request and dashboard callbacks are both absent. That is a controlled local-test behavior change; it is not a production delivery strategy or proof that callback policy caused the prior rejection.

The existing website and payment controls were not redesigned or modified. After any separately approved future test-card completion, the guest/operator returns manually to `http://127.0.0.1:3001/payment` in the same audit browser and uses **Verify payment status** only when separately authorized. Merely opening that page reads saved local status; it does not settle from a browser assertion. Preserve browser storage. Existing booking recovery requires the saved submission capability; a booking reference alone cannot authorize payment or expose a booking. Lost capability/storage remains subject to the existing recovery/support limitations; no bypass or new recovery mechanism was introduced.

Server-authoritative verification remains independent of callback navigation. Reference ownership, booking/attempt metadata bindings, test domain, exact amount/currency, provider transaction identity, reservation eligibility/revision, balance consistency, row locking and exactly-once ledger writes remain unchanged. Payment never automatically confirms a reservation. With no public webhook or automatic return, provider success may stay locally unresolved until explicit verification; do not infer failure, pay again or create a replacement attempt.

## Diagnostic code expansion

The exact code allowlist is now `missing_params`, `not_found`, `rate_limited`. Sources are documented beside the code: [generic errors](https://paystack.com/docs/api/errors/), [virtual terminal error example](https://paystack.com/docs/api/virtual-terminal/) and [rate limits](https://paystack.com/docs/api/rate-limits/). The latter two improve reviewed generic coverage; neither is claimed to explain the historical initialization validation failure.

Unknown values still become a fixed `unrecognized` label. No regex-based acceptance, arbitrary provider message, raw response, guest detail, key, header, reference value or checkout URL is retained. Existing 8 KiB / 1.5-second inspection limits, request deadline and eight-field cap remain unchanged. This cannot recover a previously suppressed code.

## All changed files

1. `server/payments/paystack.ts` — validate callback-mode configuration and conditionally omit only the callback property in the test adapter.
2. `scripts/local/paystack-test-app.mjs` — force approved omission mode for future guarded starts; does not start itself during build/testing.
3. `server/payments/providerErrorBody.ts` — add only the two reviewed exact diagnostic codes, with source links.
4. `server/payments/callbackOmission.test.ts` — 16 offline cases: exact payload, default/explicit return, invalid modes, ownership/test gates, sanitized HTTP failures and independent authoritative verification.
5. `server/payments/providerErrorEvidence.test.ts` — update reviewed-code expectations while retaining irreversible-evidence-loss/unknown-value tests.
6. `server/payments/service.test.ts` — additional manual receipt/status and duplicate-verification regression using the in-memory repository.
7. `server/payments/bookingRecoveryCompatibility.test.ts` — three fully mocked read-only recovery cases: known/unknown capability and database failure.
8. This report.

Generated `dist` artifacts were rebuilt. No frontend source, schema, dependency, lockfile, private credential configuration, staff account/role or database record changed.

## Executed verification

Commands were run from the nested project with its existing pinned package manager:

```powershell
$env:COREPACK_HOME=Join-Path (Get-Location) '.corepack'
corepack pnpm exec vitest run server/payments/callbackOmission.test.ts server/payments/providerErrorEvidence.test.ts server/payments/providerErrorBody.test.ts server/payments/providerDiagnostics.test.ts server/payments/initialization-contract-review.test.ts server/payments/initialization-audit.test.ts server/payments/paystack.test.ts server/payments/service.test.ts server/payments/testGuard.test.ts server/phase7.test.ts
corepack pnpm check
corepack pnpm build
node --check scripts/local/paystack-test-app.mjs
corepack pnpm exec vitest run server/payments/bookingRecoveryCompatibility.test.ts
```

| Check | Executed result |
| --- | --- |
| Targeted payment/authorization regressions | **142 passed**, ten files |
| Additional booking-recovery compatibility | **3 passed**, one file |
| TypeScript | **Passed**, exit 0 |
| Production build | **Passed**, exit 0 |
| Launcher syntax | **Passed**, exit 0 |

The build retains existing non-module platform-script and large-chunk warnings. The unchanged frontend bundle name remains `index-DuleuKRL.js`. No full application suite, real MySQL integration test, live provider test or browser payment walkthrough was executed. Tests mock provider transport/database access or use in-memory accounting; no development records are used. The new recovery tests were run after the build and do not change runtime source.

## Remaining risks and approval boundary

The cause of earlier HTTP 400 responses remains unknown. Removing the per-request loopback callback is supported by the documented optional parameter but may not solve other validation/account restrictions. Provider acceptance and successful checkout are unverified. If the dashboard callback changes from its reported blank state, omission inherits that setting; recheck privately before a future provider walkthrough.

The rebuilt artifact and launcher changes are ready on disk; the existing private server was **not restarted** and continues with its prior loaded code/settings. Do not use it to test the new omission behavior. A future guarded restart needs local runtime checks. No fourth booking, new initialization, verification or settlement is authorized by this implementation approval. Preserve all three unresolved attempts and stop on any uncertainty during a separately approved test. Live payments, production access and public webhooks remain disabled.
