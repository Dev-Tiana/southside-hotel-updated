# Phase 9 Stage A: guarded implementation and activation status

> Subsequent checkpoint: the guarded server was privately launched and one approved
> fictional checkout initialization was attempted. It returned no usable checkout
> URL and was stopped before card submission or verification. See the
> [first-transaction evidence and unresolved result](phase-9-first-transaction.md).
> The earlier checkpoint below records the preceding implementation/verification stage.

Stage A was explicitly approved: private test credentials, a loopback-only test launcher, outbound Paystack test requests and accounting changes only for new fictional Phase 9 bookings. Public webhook access, live keys/payments, production access and historical financial changes remain unauthorized.

## Current checkpoint

The implementation and offline/database verification are complete. **External activation is paused. No Paystack API call or actual hosted test transaction has been made at this checkpoint.** The existing preview was not restarted.

The operator reports that private credential setup completed with preflight success. The encrypted credential file and the local Phase 9 scope file exist; their secret contents have not been displayed. An independent `powershell.exe -NoProfile -File scripts/local/paystack-private.ps1 -Action Check` attempt was blocked by Windows script execution policy before it could load credentials. No policy bypass or permanent policy change was performed. Because the owner required approval for unexpected security changes, a separate decision was requested: permit a one-process execution-policy exception for this reviewed helper, run it privately in an already authorized PowerShell window, or leave activation paused. A file's existence alone is not treated as independent validation of its keys.

## Implemented safeguards

- `scripts/local/paystack-private.ps1`: Windows-only masked key prompts, test-prefix checks, DPAPI-encrypted CLIXML storage at `%LOCALAPPDATA%\SouthSideHotel\PaystackTest\credentials.clixml`, outside the repository. Refuses to overwrite an existing store. `Setup` stores keys and runs local preflight only; `Check` repeats preflight; `Start` launches the guarded app. No key values, command-line secrets, raw exceptions or environment dumps are printed. Keys are cleared from the helper's environment in `finally`.
- `scripts/local/paystack-test-app.mjs`: accepts only `--preflight` or `--start`, normally through the private helper. Verifies both test prefixes and actual owned MySQL datadir/port/schema/version, checks all 27 application tables use InnoDB, records an immutable local reservation-ID boundary, and binds only to `127.0.0.1:3001`. Uses the existing app database account. Strips unrelated inherited platform/payment configuration and ignores root dotenv. Sets test mode explicitly; mock controls are unavailable; webhook delivery is explicitly disabled. Preflight performs no provider request or database write; it can create its ignored local scope metadata file.
- `server/payments/testGuard.ts`: before any genuine provider request, independently checks the actual database is `southside_development` at the owned datadir and port 3307. External access against the integration schema is refused. Service initialization and verification require a reservation newer than the saved boundary, guest prefix `Phase Eight Fictional Phase Nine` and an `@example.invalid` email. This preserves the earlier fictional guard and excludes all old Phase 8 fixtures.
- Test-mode configuration additionally requires `SOUTHSIDE_PHASE9_BASELINE_ID` and `SOUTHSIDE_PAYSTACK_WEBHOOKS=disabled`. Existing mock mode and ordinary disabled launchers retain their purpose.
- The raw webhook route returns 404 while disabled in Stage A, before signature or accounting handling. No tunnel, public listener, dashboard URL or firewall change is created.
- Authoritative JSON verification preserves unsigned 64-bit provider IDs as exact strings using source-aware JSON parsing, avoiding rounded JavaScript IDs. Invalid/out-of-range unsafe numeric IDs fail closed. No dependency was installed.
- Existing transaction locks, reference/amount/currency/domain/metadata checks, idempotency, audit rollback, administrator authorization and manual reservation confirmation are preserved. No website design or card collection form changed.

## Commands and actual results

From the nested project folder, with the pinned pnpm installation:

```powershell
$env:COREPACK_HOME = Join-Path (Get-Location) '.corepack'
corepack pnpm exec vitest run server/payments/paystack.test.ts server/payments/service.test.ts server/payments/testGuard.test.ts
node scripts/local/phase7-preservation.mjs --phase9 --capture
corepack pnpm test
node scripts/local/test.mjs --preserve-administrator
corepack pnpm check
corepack pnpm build
node scripts/local/phase7-preservation.mjs --phase9
```

| Executed check | Result |
| --- | --- |
| Targeted payment/guard tests | 42 passed before the final additional unsigned-ID upper-bound case. |
| Complete automated suite, including that additional case | **211 passed, 51 skipped; 21 passing files, 3 database-only files skipped.** |
| Real isolated MySQL integration suite | **50 passed, 1 intentionally skipped; 3 files passed.** No administrator setup was performed. Provider requests are mocked/forbidden. |
| TypeScript | **Passed** `tsc --noEmit`. |
| Production build | **Passed** Vite/esbuild; existing platform-script and large-bundle warnings remain nonfatal. |
| Preservation comparison | **Passed:** every captured pre-Phase-9 development hotel row and staff metadata fingerprint unchanged. |
| Private PowerShell script syntax | Parser check passed without reading actual credentials. |
| Independent private credential preflight | **Blocked by execution policy**, not passed independently. No provider request sent. |

Logs: `.local/phase9-tests.log`, `phase9-mysql.log`, `phase9-typecheck.log`, `phase9-build.log`. The runner reported an unusually long full-suite elapsed duration (44,807.34 seconds); its cause was not investigated. Pass/fail counts above come from the completed run.

Database additions during automated verification are confined to new fictional integration fixtures. No new development booking or payment has been created in this stage yet. No migration ran, no dependency/lockfile changed and no production configuration was modified.

## Next step before the first external transaction

After the execution-policy decision, repeat the private `Check` action and report the sanitized result before any provider request. Do not expose keys while diagnosing failures. Verify test prefixes (not live keys), test mode, actual owned development schema/datadir, table readiness, loopback host, scope boundary and disabled webhook route. Prefix validation cannot prove the pair belongs to the same merchant; the operator selects the same business's test pair, and the first approved API request will establish actual server-key authentication.

Then start the reviewed local test process, verify its public configuration says test mode and `/api/ready` is ready, and verify `/api/paystack/webhook` returns the Stage A disabled response. Explain that a new fictional future-date booking will be created through the existing booking flow; its saved outstanding balance is sent to Paystack with only the fictional email, references/metadata and loopback callback. No booking is confirmed by paying. Do not reuse a paid/mock attempt or change existing reservation records. If a fictional email, callback or response format is rejected, stop for review rather than weakening checks or silently retrying initialization.

Once ready, use hosted Paystack **test** checkout and official fictional card details only. Test success, failure, abandonment, duplicate verification and delayed browser return where the provider permits them. Without a public endpoint, real provider webhook arrival, retransmission and asynchronous webhook-only settlement remain **unverified**; offline signed-webhook tests do not substitute for that evidence. Reconcile only the newly scoped transaction IDs/references and recheck historical preservation. No test outcome may be labelled passed before actual execution.

## Changed files for this Stage A implementation

- New `scripts/local/paystack-private.ps1`
- New `scripts/local/paystack-test-app.mjs`
- Updated `scripts/local/phase7-preservation.mjs` for a separate Phase 9 baseline
- New `server/payments/testGuard.ts`
- New `server/payments/testGuard.test.ts`
- Updated `server/payments/paystack.ts`
- Updated `server/payments/paystack.test.ts`
- Updated `server/payments/service.ts`
- Updated `server/payments/routes.ts`
- Updated `server/payments/mysql.integration.test.ts`
- New `docs/phase-9-stage-a.md`
- Updated `docs/phase-9-paystack-test-preparation.md` with this checkpoint link

Earlier Phase 9 preparation changes to `.dockerignore`, `docs/setup.md` and `docs/payment-email-backup.md` remain as previously reported. The encrypted store is outside the workspace; scope/baseline/logs and compiled build output are ignored local artifacts.
