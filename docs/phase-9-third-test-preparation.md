# Phase 9: third controlled test preparation

No third booking, payment attempt/reference, initialization, verification or settlement is authorized by preparation. No Paystack API request was made. The existing production/live/public-webhook prohibitions remain in place.

## Completed checks

- Inspected `dist/index.js`: includes `inspectProviderError`, the 8,192-byte limit, 1,500-ms diagnostic deadline, reviewed code allowlist and `providerError` projection. The built artifact is newer than the diagnostic source files.
- Inspected `scripts/local/paystack-test-app.mjs`: it launches exactly `dist/index.js` from the nested project. It requires privately loaded test-prefixed keys; verifies the owned isolated `southside_development` database and InnoDB tables; forces test mode, loopback binding and disabled public webhooks; retains the existing fictional reservation boundary. No new boundary or identifier was created.
- Inspected the fictional guard: future external payment operations require reservation ID above the existing boundary, the required Phase 9 fictional guest-name prefix and a reserved fictional email domain. This guard is intentionally broader than a single transaction; the future audit must separately enforce the approved one-booking/one-initialization scope.
- Confirmed the encrypted private credential-store file exists, without reading/displaying credentials. A fresh private preflight after stopping the old server is still required. Local prefix checks cannot prove valid provider authentication or matching merchant ownership.
- Executed `node scripts/local/phase9-second-result.mjs`: read-only owned-local database checks passed; all captured pre-existing record fingerprints and staff metadata remain unchanged. Both `SSFICTIONAL09` and `SSFICTIONAL10` remain pending manual confirmation, total NGN 50,000, zero paid and NGN 50,000 outstanding. The second attempt is still pending/initialization_uncertain, without a checkout URL and with zero ledger payments. The original attempt is included in the historical fingerprint check.
- The previous diagnostic implementation stage executed 107 passing offline tests, TypeScript and production build. Those checks were not rerun during this artifact/readiness review.

## Private restart sequence — operator action pending

1. Close local payment and payment-return browser tabs so page effects cannot trigger verification.
2. In the existing private server PowerShell window, press Ctrl+C once and wait for the prompt. Leave MySQL running. Do not terminate unrelated processes, delete data or change execution policy.
3. Confirm the old loopback listener is gone. If it remains, investigate the exact process before doing anything else; do not launch a second instance or choose another port.
4. In the same private authorized PowerShell window, run:

```powershell
& '<PROJECT_ROOT>\scripts\local\paystack-private.ps1' -Action Check
```

5. If and only if it reports `Preflight passed`, run:

```powershell
& '<PROJECT_ROOT>\scripts\local\paystack-private.ps1' -Action Start
```

6. Keep the window open. Report only successful preflight and `Server listening on 127.0.0.1:3001`, never private credential contents. Do not use `Diagnose`, click payment verification or initialize checkout.
7. Independently verify safe `/api/ready`, public test-mode configuration, loopback-only listener and disabled webhook route. Check the new process start time against the build; do not infer a running update solely from an artifact on disk.

The current review has not yet confirmed old-server shutdown, fresh private preflight or updated running-process checks. Local URL after successful restart: `http://127.0.0.1:3001/`.

Follow-up: the operator reported Ctrl+C completed and the private PowerShell prompt returned. An independent listener check still found Node process 16772 on `127.0.0.1:3001`, parent process 18352, started at local system time 2026-10-28 09:50:42. Only process identity/start time were inspected; no environment, command-line arguments or credentials were read. This does not yet establish which helper invocation owns the listener. Startup is paused pending clarification; no process was terminated and no second instance, booking or provider request was started. The operator has been asked whether the helper was restarted or another private window remains open.

## Exact proposed test scope — explicit approval required after readiness

1. Create exactly one new clearly fictional Phase 9 reservation through the existing booking flow, using non-overlapping dates and available fictional inventory. Reuse neither previous booking for initialization. Do not generate a submission identifier or payment reference before approval.
2. Read back the saved server-calculated nightly snapshot, tax, NGN total, zero paid, full outstanding and pending-manual-confirmation status. Recheck test credentials/configuration, database identity, old-record preservation and single-attempt/duplicate-prevention safeguards. Stop on any unexpected amount or security discrepancy.
3. Initialize checkout exactly once for that new booking. No automatic or manual retry, replacement reference or additional booking is permitted.
4. If HTTP 400 or another error/uncertainty occurs, stop immediately. Capture only the new sanitized server diagnostic: HTTP status, fixed parsing outcome, allowlisted provider category/code and safe validation field names. Never copy a raw body, message, key, header, guest detail, reference value or checkout URL into diagnostic evidence. Do not perform a follow-up verification without approval after the stop.
5. If initialization succeeds, review the next checkout/payment action explicitly. Preparation does not authorize card submission, additional external verification or financial settlement. A future approval must specify whether it also includes official fictional test-card completion, authoritative verification and settlement of only the new fictional booking; no broader authority is inferred.
6. Any authorized success must still yield exactly one ledger payment, correct outstanding balance and unchanged manual-confirmation status. Preserve both earlier unresolved attempts and all existing financial records throughout.

## Remaining risks

The HTTP 400 cause remains unknown; new diagnostics cannot recover earlier discarded bodies. Unknown provider codes/messages are intentionally suppressed, and field-level details may not exist. Metadata remains unchanged because official documentation differs on its representation. Test-prefixed keys do not prove provider-side validity or currency/account eligibility. No public webhook delivery will occur; public exposure requires separate approval. No migration, production operation or live payment is part of this plan.

## Restart clarification and final runtime checks

The operator confirmed they had restarted the approved helper. The remaining listener therefore corresponds to the reported restart, rather than an unexplained shutdown failure. No second instance was started by the audit and no process was terminated.

Independent follow-up checks passed:

- `/api/ready`: `{"status":"ready"}`.
- `payment.config`: `enabled:true`, `mode:"test"`. The gate requires test-prefixed keys, the development schema and disabled-webhook/fictional-scope settings. This is configuration validation, not provider authentication.
- POST `/api/paystack/webhook`: HTTP 404.
- Exactly one listener on port 3001, bound to `127.0.0.1`, Node process 16772.
- Process start time is later than the rebuilt artifact timestamp. Together with the operator-confirmed helper restart and inspected launcher target, this supports loading the corrected build without exercising the payment adapter or inspecting process secrets.
- Repeated read-only owned-database preservation check passed. Both unresolved bookings retain their original totals/status/balances and all captured pre-existing hotel/financial fingerprints and staff metadata are unchanged. No provider request was made by these checks.

Readiness: artifact, launcher, operator-reported restart and runtime security/preservation checks are complete. Provider-side credential validity and the historical rejection cause remain unestablished. The next step requires explicit approval for one new fictional booking and exactly one initialization. Stop on any error or uncertainty; successful initialization alone does not authorize card submission or settlement. No transaction approval is presumed.
