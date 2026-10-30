# Phase 9: second controlled test readiness

## Historical evidence recorded on 2026-10-28

The owner reports checking the Paystack dashboard in **Test Mode** and finding no transaction history showing the original NGN 50,000 attempt. This is owner-reported dashboard evidence, not an independently inspected export or a new API result.

The existing sanitized `.local/phase9-verification-diagnostic.json` records the separately approved read-only verification: HTTP 400, `transaction_reference_not_found`, 1,079 ms, transaction status **unestablished**, and unchanged local records. No new provider request was made for this readiness review.

These findings do not reconstruct the discarded original initialization response or prove its precise failure stage. Preserve booking **SSFICTIONAL09** and its unresolved attempt; do not retry initialization, clear uncertainty, replace its reference or adjust its balances.

## Checks completed

- Inspected `dist/index.js`: initialization contains `amount: cents(a.amount).toString()` and the corrected diagnostic handling. NGN 50,000.00 serializes as the string `"5000000"` in minor units. The build is newer than the corrected source files.
- Inspected the guarded launcher: it launches that built file, requires test-prefixed keys, verifies owned local MySQL and InnoDB tables, selects only `southside_development`, binds to loopback port 3001, disables public webhooks and applies the fictional-booking boundary. No live-mode configuration is enabled.
- Confirmed that the private credential-store file exists, without reading or displaying its contents. Existence alone does not prove key validity or account ownership. A fresh private `-Action Check` is requested; it performs no Paystack call and does not start the application.
- Executed `node scripts/local/phase7-preservation.mjs --phase9-correction`: **passed** against the owned local development database. Exact row membership and fingerprints remain unchanged, including reservations, attempts, events, ledger, inventory, history and staff metadata.
- Reviewed the saved diagnostic and the [corrective-stage verification report](phase-9-corrective-stage.md). No tests, migrations, build, settlement or integration fixture creation were repeated for this documentation/readiness review.

The application is currently stopped. The corrected artifact is ready on disk; it has not been verified as an active running process during this review. Private preflight cannot prove provider authentication without an authorized external request. No external request is permitted at this stage.

## Private check before transaction approval

Run in the existing authorized private PowerShell window; do not paste credentials into chat or change execution policy:

```powershell
& '<PROJECT_ROOT>\scripts\local\paystack-private.ps1' -Action Check
```

Only report whether `Preflight passed`. Do not use `Diagnose`, initialize checkout, or create a fixture/reference. The old attempt stays untouched.

The owner subsequently reported **Preflight passed** from this private local-only check. This confirms the helper accepted the privately loaded test-key prefixes, test configuration and isolated database readiness. It does not establish provider-side authentication or prove that the two keys belong to the same integration; no Paystack request was made by the check. The application remains stopped.

## Proposed controlled test — awaits explicit approval

1. Close old payment-return tabs before starting the guarded application, to prevent automatic verification requests. Start through the private helper's `-Action Start`; confirm the loopback listener, safe readiness response and test-only configuration. Browser URL: `http://127.0.0.1:3001/`. This URL is unavailable while stopped.
2. Recheck the owned database, test-key prefixes, disabled webhooks, fictional scope and administrator authorization. Stop on any discrepancy. No public endpoint or tunnel is needed.
3. Create **one new** clearly fictional Phase 9 booking, using an `@example.invalid` address and the existing required fictional name prefix. Choose dates separate from the original booking and check availability. Do not generate a submission identifier or payment reference before approval.
4. Read back the saved server-calculated amount, currency, zero amount paid, outstanding balance and pending-manual-confirmation status before initialization. An expected NGN 50,000 two-night example is only a plan: availability and server pricing must be revalidated, and an unexpected amount requires review before proceeding.
5. Initialize checkout **once**, producing only that new booking's single payment attempt/reference. Check the provider reference and approved HTTPS checkout URL. On any timeout, rejected response or uncertainty, stop and preserve evidence; do not retry or create another reference.
6. Inspect the hosted page's test-mode indication and use only official Paystack fictional test details. Never enter real card information. Authoritative verification must match reference, amount, currency, test domain and booking binding before settlement.
7. Verify exactly one ledger payment, correct outstanding balance, transaction/audit history and unchanged pending-manual-confirmation status. Verify duplicate callback/verification handling against this same new transaction without a second initialization or second settlement.
8. Recheck preservation of the original booking and all pre-existing financial records. No cleanup, manual financial adjustment, reservation confirmation or public webhook setup is included.

Explicit approval is required for **creating the new fictional booking/reference, making external Paystack requests, entering the fictional test checkout and settling only that new fictional booking**. None is performed by this report. Public webhook configuration remains separately prohibited. Webhook delivery and delayed webhook reconciliation cannot be verified end to end without separate approval for public access; existing offline signature/idempotency coverage is not a substitute for that delivery test.

## Readiness conclusion

Code, built artifact, launcher safeguards, database preservation checks and the owner-reported fresh private preflight are ready. Operational readiness remains conditional on guarded startup/runtime checks and explicit transaction approval. The original initialization's root cause remains unresolved; improved diagnostics apply to future requests and cannot recover discarded historical evidence.
