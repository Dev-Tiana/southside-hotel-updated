# Phase 9: Paystack test-mode preparation and approval review

> Stage A was subsequently approved and its guarded implementation is now prepared.
> See [Stage A implementation, executed tests and activation checkpoint](phase-9-stage-a.md).
> The independent credential check is currently blocked by Windows execution policy;
> no external Paystack request has been sent. The preparation findings below record
> the original review, not a claim that later readiness gaps are still unimplemented.

Audit date: 27 October 2026. **Preparation only; actual Paystack test mode has not been activated.** No external payment request, tunnel, public webhook, test transaction, migration or database write was performed during this audit. The existing local preview reported `{enabled:true, mode:"mock"}` through its sanitized configuration endpoint. Its simulation behavior and the existing staff session were left intact. Live payments remain disabled.

## Confirmed code findings

| Area | Finding |
| --- | --- |
| Adapter: `server/payments/paystack.ts` | Fixed HTTPS Paystack host, server-only Bearer authentication, 10-second timeout, redirects rejected, checkout URL restricted to `https://checkout.paystack.com`, test-only keys and `domain=test` accounting checks. |
| Initialization: `server/payments/service.ts` | Charges the saved NGN outstanding balance, not browser totals. Binds reference, booking, amount, revision and environment. Concurrent requests reuse one unresolved attempt; uncertain initialization blocks a replacement charge. |
| Verification | Uses server `GET /transaction/verify/{reference}`. Compares amount, currency, domain, reference, metadata, provider identity and current booking revision/balance before applying credit. Callback query parameters alone cannot settle a booking. |
| Accounting: `server/payments/repository.ts` | Category/reservation/attempt row locks, unique provider/reference/event constraints and one transaction for ledger, balances and audit history. No automatic booking confirmation, refund or reconciliation override. |
| Webhook: `server/payments/routes.ts` | Raw JSON bytes parsed before the general body parser; 128 KB limit; timing-safe HMAC-SHA512 check with the Paystack secret key. Handles `charge.success` by fetching authoritative verification. Bad signatures return 401; unresolved authoritative verification returns 503; duplicate settlements remain idempotent. |
| Administrator controls | `admin.payments` and `admin.verifyPayment` retain server-side administrator authorization. No manual balance override was added. |
| Guest checkout | Existing shell/design, same-tab hosted checkout, return receipt, explicit test banner, actual booking status and manual verification controls. No hotel-hosted card inputs. Browser capability storage is required; missing storage fails closed. |
| Current local launchers | `scripts/local/app.mjs` disables payments and removes keys; `payment-app.mjs --mock` strips keys and runs simulation only. Neither supports genuine test mode, even if keys are entered into the parent PowerShell session. |
| Public configuration | Exposes enabled/mode only for payments. Paystack keys are not serialized into platform config or client variables. |

### Gaps to resolve before external testing

1. A dedicated, explicitly approved **test-only local launcher** must load private credentials, recheck actual database ownership/datadir/port, bind to loopback, and require approval before enabling its network gate. Existing mock launchers must remain unchanged in purpose. No such launcher was created or run in this preparation stage.
2. Fresh fixtures must satisfy the current guard: guest name starts `Phase Eight Fictional` and email ends `@example.invalid`. A suitable new name is `Phase Eight Fictional Phase Nine Test Guest`. This avoids weakening the guard or renaming old guests. Paystack's acceptance of reserved-domain fixture emails is not yet verified; if rejected, stop for approval before introducing a different bounded fixture policy. Do not send real customer addresses. Check provider-side receipt settings separately from the application's disabled notification delivery.
3. Use **new bookings with no mock attempts**, not the paid Phase 8 fixture. Attempts bind their mode; switching to test mode cannot convert or reverify old mock attempts. The admin list can still show old mock history; reverifying those under a test provider correctly refuses an environment mismatch.
4. Keep the browser at exactly `http://127.0.0.1:3001`, including return navigation. `localhost`, a tunnel domain or a different port is a different storage origin and can lose guest capability access. Planned callback: `http://127.0.0.1:3001/payment/return`. Provider acceptance of this loopback callback must be checked during the approved test initialization. If rejected, stop and review an alternative; do not automatically expose the website/dashboard or change staff cookie policy.
5. Failed/abandoned results need explicit verification; browser closure alone does not establish either outcome. There is no unattended reconciliation worker. A webhook cannot be assumed to arrive for a failed payment. Administrator/guest verification and a scoped manual reconciliation worksheet are the current recovery paths.
6. An uncertain initialization remains unresolved without a checkout URL. Investigate the same reference; do not clear the attempt or generate a second charge automatically. Review flags and reversals need a separately approved resolution process.
7. Provider IDs are stored as text, but the JSON adapter rejects numeric IDs beyond JavaScript's safe-integer range. It fails closed instead of rounding. A lossless unsigned-64-bit response strategy and offline tests should be reviewed before activation; no dependency upgrade or schema change is required merely to document this gap.
8. Initialization currently passes metadata as an object, as shown in Paystack's metadata guide; the transaction API parameter table describes stringified JSON. Mocks prove neither interpretation against the real service. Confirm exact round-trip `booking_reference` and `attempt_reference` under approved test mode; missing metadata must continue to block credit. Do not loosen binding checks to make a test pass.
9. No explicit cancellation return (`metadata.cancel_action`) is supplied to hosted checkout. Closing/back navigation must be tested, followed by verification from `/payment`; add a tested return action later if needed, preserving the original browser origin.
10. The existing `.dockerignore` omitted `.local`, despite `Dockerfile` using `COPY . .`. That could include private database files in a build context. This preparation adds `.local/` and `.corepack/` exclusions. No Docker build, upload or deployment was run.

No new database table or migration is currently proposed. Any later need for a migration or changes to historical financial records requires a new review and approval.

## Required credentials and settings

Sign in yourself to the authorized hotel's [Paystack Dashboard](https://dashboard.paystack.com/) and select **Test mode** for the correct business. Current docs place keys in **Developers overview**; some dashboard versions use **Settings → API Keys & Webhooks → Test Mode**. Copy only the test pair from that business. Do not generate/rotate keys unnecessarily or touch live settings. [Official key guidance](https://paystack.com/docs/api/authentication/), [dashboard settings guidance](https://support.paystack.com/en/articles/2123458).

| Setting | Required value/purpose | Configure now? |
| --- | --- | --- |
| `PAYSTACK_SECRET_KEY` | Test secret beginning `sk_test_`; server initialization, verification and webhook signing. Never a live/restricted key. | Privately stage only if desired; never paste into chat. |
| `PAYSTACK_PUBLIC_KEY` | Matching business's `pk_test_` public key. Current configuration gate requires it, although the hosted server-initialized flow does not otherwise use it. | Privately stage with the secret. |
| `SOUTHSIDE_PAYMENTS_MODE` | `test` for approved external testing; currently mock preview remains mock. | **Leave unchanged until approval.** |
| `PAYSTACK_TEST_NETWORK_APPROVED` | `1` is the code's explicit network gate. It is not a credential or a substitute for owner approval. | **Do not set to 1 yet.** |
| `DATABASE_URL` | Existing private app account for the owned `southside_development` schema at `127.0.0.1:3307`; integration fixtures use the separate integration schema/account. | Reuse guarded configuration; do not type credentials into chat or invent a replacement URL. |
| `HOST`, `PORT` | `127.0.0.1`, `3001`. No all-interface binding. | Existing local settings. |
| `STAFF_AUTH_ORIGIN` | Exactly `http://127.0.0.1:3001`, no trailing slash; also determines `/payment/return`. | Keep existing local origin. |
| `STAFF_AUTH_ALLOW_LOCAL_HTTP` | Existing `1` for loopback-only staff login; not permission for public HTTP. | Keep existing local exception; no public dashboard exposure. |
| `DOTENV_CONFIG_PATH` | Existing `.local/no-env-file`, so unrelated root `.env` credentials are not loaded by the guarded launcher. | Preserve in the future test launcher. |
| `SOUTHSIDE_PAYMENT_MOCK` | Marker only for mock simulation; clear it in a future genuine-test launcher. | Leave the current mock process alone. |
| Test dashboard callback | Intended browser destination `http://127.0.0.1:3001/payment/return`; the initializer explicitly supplies it, overriding the dashboard default. | Do not alter dashboard settings yet. |
| Test dashboard webhook | Future approved HTTPS relay URL ending `/api/paystack/webhook`. Do not put localhost here. | **Not configured; separate approval needed.** |

There is **no separate webhook secret** in this integration. `PAYSTACK_WEBHOOK_SECRET` and `PAYSTACK_CALLBACK_URL` are unused legacy names. No `VITE_PAYSTACK_SECRET_KEY`, Manus credentials, bank payout details, live activation or real card information is required. Paystack uses the same API hostname for both environments; test keys determine test access, while local gates and response checks add protection. [Paystack API environments](https://paystack.com/docs/api/).

If the merchant account has API IP restrictions enabled, its test settings must permit this computer's actual outbound public IPv4 address. `127.0.0.1` is not that address. Inspect this privately and approve any dashboard change first; do not disable restrictions blindly. [Paystack authentication/IP guidance](https://paystack.com/docs/api/authentication/).

## Private Windows staging, without activation

No credential prompt was opened and no credential store was created by this audit. Do not share keys through chat, screenshots, source files or command arguments. The following is an optional **manual, local-only staging procedure**, not an app startup command. Run it yourself in a private Windows PowerShell window without a transcript or screen sharing. Do not put literal keys into the script. It uses built-in Windows protection and installs nothing.

```powershell
# Windows only. Stores SecureStrings encrypted for this Windows identity/computer.
# The file is outside the repository, Docker context and normal project backups.
$phase9Directory = Join-Path $env:LOCALAPPDATA 'SouthSideHotel\PaystackTest'
$phase9CredentialFile = Join-Path $phase9Directory 'credentials.clixml'
if (Test-Path -LiteralPath $phase9CredentialFile) {
    throw 'An existing private test credential file exists. Review it; do not overwrite it.'
}
$null = New-Item -ItemType Directory -Path $phase9Directory -Force
$phase9Secret = Read-Host 'Paste Paystack TEST SECRET key privately' -AsSecureString
$phase9Public = Read-Host 'Paste matching Paystack TEST PUBLIC key privately' -AsSecureString
try {
    [pscustomobject]@{
        SecretKey = $phase9Secret
        PublicKey = $phase9Public
    } | Export-Clixml -LiteralPath $phase9CredentialFile -Depth 3 -NoClobber
} finally {
    $phase9Secret.Dispose()
    $phase9Public.Dispose()
    Remove-Variable phase9Secret,phase9Public -ErrorAction SilentlyContinue
}
Write-Host 'Test credentials staged privately. Payments have NOT been activated.'
```

Windows `Export-Clixml` protects SecureString/credential values using DPAPI, tied to the Windows user and computer. This is not protection against software running as that same user; keep the user profile and directory private. Do not copy the file into the repository. The procedure has not been executed against actual credentials during this audit. [Microsoft's Windows credential export documentation](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/export-clixml?view=powershell-5.1).

After approval, the reviewed test-only launcher will import this store privately, check prefixes without displaying values, validate actual owned database identity, supply decrypted values only in the application child's environment, and discard parent references. It must not print environment dumps, decrypted values, request Authorization headers or raw provider responses. Server memory necessarily contains the API key while running. No process-wide/machine-wide `setx`, committed `.env`, third-party secret manager or automatic activation is needed. The current launchers intentionally do not read this store.

## Webhook exposure proposal — not configured

Keep the application and MySQL on loopback. Following a separate approval, use a reviewed, temporary HTTPS relay/tunnel that forwards **only POST `/api/paystack/webhook`**, preserves raw bytes and `x-paystack-signature`, limits request size/time and does not log request bodies or secrets. Block every other path/method, including `/admin`, staff login, tRPC, media, health/config and booking routes. Forwarding all of port 3001 is not this proposal. The provider/tunnel software, hostname, credentials and access policy must be selected and reviewed before launch; no package, tunnel account or public route is configured now.

Enter that exact relay URL in the correct business's **test webhook** settings only. The browser callback stays on the original loopback origin. Inspect test delivery history in **Developers → Webhooks** and use its retry action where available; do not alter live URLs. Paystack requires a publicly reachable webhook and signs payloads with the secret key. Current documented test retries are hourly for ten hours, with a thirty-second request timeout; the handler's provider request has a ten-second timeout and returns a retryable failure when verification is unresolved. [Webhook protocol](https://paystack.com/docs/payments/webhooks/), [test delivery history/retry guidance](https://support.paystack.com/en/articles/10609026).

## Scoped test plan after approval

Before any transaction: resolve readiness gaps, rerun offline tests/check/build, verify owned schema and migration history without changing it, capture fresh preservation fingerprints, and identify a dedicated fictional category/rate/date range without touching old inventory commitments. Use new submission capabilities and test-mode attempts only. Record new reservation IDs/references so every later write and reconciliation query is bounded to the approved fixtures.

| Scenario | Procedure | Required result |
| --- | --- | --- |
| Successful payment | New fictional booking; saved-price initialization; official successful test card entered only on hosted test checkout. | Exact saved NGN amount/currency/reference/metadata/domain; one ledger entry; correct paid/outstanding; unchanged booking/manual-confirmation status and snapshots. |
| Failed payment | Separate fixture; official declined test card; explicit server verification even if no webhook occurs. | No credit; meaningful failed/unresolved result; inventory/status preserved. Never infer failure from a closed browser. |
| Abandoned checkout | Separate fixture; close/back out without payment; reopen original-origin `/payment` and verify. | Remains pending/ongoing until provider actually reports abandoned; no credit or premature replacement checkout. Record if provider abandonment timing cannot be reproduced. |
| Duplicate requests | Concurrent same-intent initialization, repeated callback/verify and retry of the same signed provider delivery. | One unresolved attempt and at most one credit; duplicates acknowledge safely; no second reservation or confirmation. |
| Delayed callback | Complete approved hosted test payment without immediately returning; deliver webhook/reverify later. | Authoritative settlement can complete once without browser callback; return page later shows the same receipt. |
| Delayed webhook | Only on scoped fixtures, keep approved relay unavailable temporarily, restore it, then use test dashboard retry/manual verification. | No fabricated success while unresolved; later matching success applies once; acknowledge committed/duplicate result. Do not promise a specific automatic retry arrival time. |
| Signature/body tamper | Send controlled local negative probes with missing/wrong signature or changed bytes; compare a genuine signed test delivery through the approved relay. | 401 and no financial change for invalid signatures; preserve raw-body validation. No logging of test keys or replay bodies containing customer/card details. |
| Provider timeout/unavailable | Offline fault injection first; approved test checks only if naturally reproducible. | Safe unavailable/pending state, original reference retained, no replacement charge or credit based on timeout. |
| Wrong binding/amount/currency/domain/provider ID | Offline tests plus fresh isolated database fixtures. Do not try to manufacture corrupt Paystack transactions or alter existing bookings. | Review required/no credit; frozen audit evidence. Authoritative test calls remain reference-bound. |
| Late success after amendment/cancellation | Existing offline/database coverage; any new external reproduction requires fixture-specific approval first. | No automatic rewrite of revised finances; review rather than silent overpayment/refund. |
| Guest/admin access | Same browser storage, forged reference without capability, another booking capability, ordinary user and expired staff session. | Access denied where appropriate; existing administrator sees only protected operations; no auth bypass or privilege change. |
| Desktop/mobile layout | Existing owned audit browser at desktop and mobile widths with normal login; inspect hosted test checkout and callback separately. | Clear test banner, actual saved status/receipt, no card fields on the hotel site. Real-phone testing needs separately reviewed connectivity; a phone's localhost is not this computer. |

Use Paystack's [official test-payment details](https://paystack.com/docs/payments/test-payments/) with a future expiry date; never use personal cards or real bank transfers. Start with hosted card checkout only. Refunds, recurring charges, saved-card charging, disputes and payouts are outside this approval. The provider's [verification guide](https://paystack.com/docs/payments/verify-payments/) documents success webhooks and the other verification statuses; test mode does not prove live settlement behavior.

### Transaction reconciliation and stop conditions

For each newly approved fixture, compare Paystack's **test** dashboard and authoritative verification with local `payment_attempts`, `payment_events`, `payments`, audit entries and reservation balances. Capture only necessary sanitized fields: local booking/payment reference, provider ID as text, mode/domain, amount in kobo, currency, provider status, ledger count, paid and outstanding. Metadata bindings must match the saved booking/reference. Do not export API keys, card/authorization objects, full webhook bodies, real customer contacts or unrelated historical rows.

Acceptance: each successful matching reference has exactly one paid ledger row; other statuses have none; paid plus outstanding equals the saved total; no negative outstanding/over-credit; stay/status/snapshots unchanged except the approved fixture's paid/outstanding fields; all pre-test hotel/staff preservation fingerprints match. Review flags, provider timeout, unsafe large IDs, missing metadata or dashboard/local disagreement halt that fixture for investigation. Never fix discrepancies by editing balances, deleting ledger rows, changing reservation commitments or marking an unpaid booking paid. Stop and request new approval if remediation affects existing records, requires a migration or changes business/payment rules.

This is **transaction/accounting reconciliation**, not a claim of real bank settlement. Paystack test mode does not process live settlements. Shut down the approved relay and remove its test dashboard URL when testing ends; do not delete fixtures or historical ledger entries as cleanup. Recheck preservation fingerprints and return the app to the approved mock/disabled launcher. [Test environment limits](https://paystack.com/docs/api/authentication/).

## Work performed and verification evidence

- Read-only source/configuration audit of adapter, service, repository, routes, router authorization, guest flow, launchers, ignore rules and Dockerfile. No actual keys or private database configuration contents were displayed.
- Read-only loopback `payment.config` request: HTTP 200, enabled true, mode mock. No booking mutation, provider request or database integration test ran in this phase.
- Executed `corepack pnpm exec vitest run server/payments/paystack.test.ts server/payments/service.test.ts`: **32 passed, two files passed**. The initial sandbox run could not load config because esbuild was denied filesystem access; the escalated offline rerun passed. Tests use dummy keys and mocked providers/fetch, not actual credentials.
- The full suite, real MySQL integration suite, TypeScript and build were not rerun for this documentation/ignore-only preparation. Their previous Phase 8 results remain in its report and are not presented as new Phase 9 execution.
- Changed only `.dockerignore`, `docs/setup.md`, `docs/payment-email-backup.md` and this new document. No application code, database schema/records, staff account, website design, payment gate or production configuration was changed.

## Approval required — pending

**Stage A:** authorize a private test credential prompt/loader, the reviewed local test-only launcher, outbound test initialization/verification to `api.paystack.co` and hosted test checkout, plus creation/settlement of **new clearly fictional Phase 9 bookings only**. This sends only their fictional email, server amount/currency, references/metadata and callback URL; the provider also sees connection information. Existing mock/real/historical bookings and live keys remain excluded. No action in Stage A is authorized by this preparation report itself.

**Stage B, separately:** authorize a named temporary public HTTPS webhook relay, its route-only policy, any required software/account configuration, changes to the merchant's **test** webhook setting and test delivery/retry probes. Stage A does not implicitly approve Stage B or a public website/dashboard.

Wait for explicit owner approval before starting either stage. No authorization for live payments, production access or deployment is requested.
