# Phase 8: test-only payments and verification

Verified locally on 27 October 2026. The running preview is a **local simulator**, not a Paystack connection. No real credentials, funds, external payment calls, production access or deployment were used.

## Completed behavior

- Replaced the old browser-amount initializer and logging-only webhook with server-owned payment attempts. Checkout uses the saved reservation outstanding balance and NGN currency; browser amounts, email overrides and foreign financial fields are rejected.
- Each attempt binds a generated reference, hashed request identifier, reservation, immutable stay/financial revision, amount, currency and mock/test environment. One unresolved checkout is allowed per booking. Concurrent initialization and retries reuse it. An uncertain initialization blocks replacement checkout instead of risking a second charge.
- Guest operations require the existing high-entropy booking-submission capability. References alone cannot authorize payment or access another booking. Capabilities are never put in return URLs. Browser payment request identifiers persist under Web Locks; unsafe storage fails closed.
- Implemented Paystack's server initialization and authoritative verification adapters with a fixed HTTPS API host, timeout, no redirects, strict checkout-host validation, subunit amounts and metadata binding. Only explicitly authorized test configuration can use them. Live credentials and live-domain verification are rejected. The actual network adapter was tested with mocked fetch responses only.
- Raw-body SHA-512 HMAC verification uses the actual Paystack secret key, timing-safe comparison and a 128 KB body limit. Known, signed success events trigger authoritative verification; webhook payload amounts cannot credit a booking. Pending authoritative verification returns 503 for retry; invalid signatures return 401. Duplicate webhooks/callbacks cannot duplicate ledger entries.
- MySQL transactions acquire category, reservation and attempt locks in the same order as booking operations. Attempt/provider/event uniqueness and the existing ledger reference constraint protect accounting. Ledger insertion, balances, events and audit history commit together or roll back together.
- A successful matching result increases paid/reduces outstanding exactly once. It preserves reservation status, dates, room quantity, price/terms snapshots and inventory commitments. **Payment never automatically changes pending manual confirmation to confirmed.** Failed, pending, processing and abandoned attempts never credit or release inventory.
- Wrong amount/currency/domain/reference, reused provider transaction IDs, stale amendments/cancellations, inconsistent balances, overpayment and reversals require review. They do not silently credit, refund or rewrite existing accounting. A contradictory result after settlement visibly requires review while retaining the original ledger entry. Review flags cannot be cleared through this phase's UI.
- Added guest payment/receipt, callback and simulation pages in the existing website shell, plus administrator payment attempts/events and authoritative reverification. No card fields, manual credit, refund or accounting override controls were added. Server administrator authorization remains mandatory; ordinary users and staff cannot access payment administration.
- Test initialization is limited to newly created guests named `Phase Eight Fictional ...` with `@example.invalid` email addresses. This deliberately prevents accidental use against existing bookings in this phase.

Protocol reference: Paystack's [transaction API](https://paystack.com/docs/api/transaction/), [verification guidance](https://paystack.com/docs/payments/verify-payments/) and [webhook guidance](https://paystack.com/docs/payments/webhooks/). Actual Paystack behavior remains to be verified with an approved test account; mocks do not prove provider connectivity.

## Approved migration and record preservation

The reviewed `0005_test_payment_processing.sql` was applied after explicit approval to **southside_development** and **southside_integration**, on the owned loopback MySQL instance only. It creates `payment_attempts` and `payment_events`, their unique constraints and foreign keys. Both use InnoDB. It does not alter or backfill an existing hotel table, change staff permissions or create an account. Complete migration journal/hash/snapshot ordering and existing schema conflicts were checked first. There are now 27 application tables, plus the migration journal.

The separate approval for mock settlements was used only for new, clearly fictional Phase 8 fixtures. Tests append fictional records; they do not delete historical fixtures. The development preservation checker compared every pre-Phase-8 reservation, guest, financial/payment, room/category/rate, inventory, housekeeping, maintenance, settings, media and audit row with captured fingerprints. Staff identity/role/enabled metadata also matched. No pre-existing hotel record or financial snapshot changed. Normal private sign-in updates session/authentication activity as expected; no credentials or roles were modified.

The browser fixture is **SSZ137EKSLIE**: NGN 50,000.00, paid NGN 50,000.00, outstanding NGN 0.00, still **pending manual confirmation**. It is explicitly fictional and locally simulated. Failed and abandoned attempts remain in history; the successful attempt produced one paid ledger entry. No payment receipt email was sent.

## Executed verification

All commands ran from the nested `southside-main` folder using the existing pnpm 10.18.0 lockfile and installed dependencies. No package or lockfile upgrade was needed.

| Check | Final executed result |
| --- | --- |
| `corepack pnpm test` | **200 passed, 49 skipped**, 20 passing files and 3 database-only files skipped. |
| `node scripts/local/test.mjs --preserve-administrator` | **48 passed, 1 intentionally skipped**, 3 passing files on real isolated MySQL. Includes 16 payment, 19 hotel-operation and 13 executed authentication cases. Administrator setup is intentionally excluded. |
| `node scripts/local/auth-http-check.mjs` | Passed real loopback HTTP password/session/origin/logout checks, anonymous 401 and ordinary-user 403 payment administration denials, and disabled-payment initialization/config checks. Only a non-privileged integration fixture account was used. |
| `corepack pnpm check` | Passed `tsc --noEmit`. |
| `corepack pnpm build` | Passed Vite and esbuild production compilation. Existing non-module platform-script and large-bundle warnings remain nonfatal. |
| `node scripts/local/phase8-browser.mjs`, then `--resume` | Passed one public fictional booking, pending/failed/abandoned/success UI paths, receipt reload, repeated verification, exactly one ledger payment, unchanged price/terms snapshots and manual status; 1440 px desktop and 390 px mobile without horizontal overflow. |
| `node scripts/local/phase8-browser.mjs --admin` | Passed with the existing administrator's normal private login: payment history, events, authoritative mock reverification, manual status and desktop/mobile layouts. No session was injected or account created. |
| `node scripts/local/phase7-preservation.mjs --phase8` | Passed preservation of all captured pre-phase hotel rows and staff metadata. |

Payment integration coverage includes simultaneous initialization, six concurrent settlements, failed/abandoned/pending outcomes, partial saved balance, wrong booking capability, stale amendments/cancellations, wrong amount/currency/domain/metadata, global provider-ID reuse, actual transaction rollback on audit failure, and real loopback signed webhook concurrency/retry/signature handling. Its external fetch spy asserts zero network adapter calls.

One intermediate integration run failed because its fixed mock provider ID collided with a prior test run. The fixture now generates a fresh ID while deliberately reusing it between two bookings within that test; the final full integration run passed without deleting earlier data. The first public audit stopped on a navigation timing assertion after the pending simulation. The audit script was corrected to wait for the callback and verification to finish, then resumed the same booking. No replacement booking was created.

Additional executed preparation commands:

```powershell
$env:COREPACK_HOME = Join-Path (Get-Location) '.corepack'
# SQL generation was offline, with a deliberately unusable placeholder URL:
$env:DATABASE_URL = 'mysql://offline:unused@127.0.0.1:1/offline'
corepack pnpm exec drizzle-kit generate --name test_payment_processing
# Separate guarded processes use privately stored local configuration:
node scripts/local/migrations.mjs
node scripts/local/phase7-preservation.mjs --phase8 --capture
node scripts/local/migrations.mjs --apply
node scripts/local/payment-app.mjs --mock
# Existing audit profile only; private sign-in was completed by the operator:
node scripts/local/phase5-browser.mjs --sign-in --status
```

Local verification evidence is in `.local/phase8-tests.log`, `phase8-mysql.log`, `phase8-http.log`, `phase8-typecheck.log`, `phase8-build.log`, `phase8-public-results.json`, `phase8-admin-results.json` and desktop/mobile PNGs. These files remain local and ignored; no session credentials are captured.

## Changed files

Database and migration (4):

- `drizzle/schema.ts`
- `drizzle/0005_test_payment_processing.sql` (new)
- `drizzle/meta/0005_snapshot.json` (new)
- `drizzle/meta/_journal.json`

Server and automated tests (15):

- `server/payments/paystack.ts`
- `server/payments/repository.ts` (new)
- `server/payments/service.ts` (new)
- `server/payments/routes.ts` (new)
- `server/payments/paystack.test.ts` (new)
- `server/payments/service.test.ts` (new)
- `server/payments/mysql.integration.test.ts` (new)
- `server/_core/index.ts`
- `server/routers.ts`
- `server/db.ts`
- `server/database.test.ts`
- `server/admin-page.test.ts`
- `server/management/compatibility.ts`
- `server/management/mysql.integration.test.ts`
- `server/management/migration.test.ts`

Client (7):

- `client/src/lib/paymentRequest.ts` (new)
- `client/src/pages/Payment.tsx` (new)
- `client/src/components/PaymentsPanel.tsx` (new)
- `client/src/App.tsx`
- `client/src/pages/Admin.tsx`
- `client/src/components/BookingWidget.tsx`
- `client/src/index.css`

Local tooling (7):

- `scripts/local/app.mjs` (explicitly keeps ordinary preview payments disabled)
- `scripts/local/payment-app.mjs` (new; guarded local simulator only)
- `scripts/local/test.mjs`
- `scripts/local/migrations.mjs`
- `scripts/local/auth-http-check.mjs`
- `scripts/local/phase7-preservation.mjs`
- `scripts/local/phase8-browser.mjs` (new)

Documentation (3):

- `docs/phase-8-review.md` (new)
- `docs/phase-8-implementation.md` (new)
- `docs/local-preview.md`

Total: 36 source, migration, test, tooling and documentation files. Generated `dist` build output and ignored local evidence are additional local artifacts.

## Local browser inspection and remaining requirements

- Website: http://127.0.0.1:3001/
- Booking/recovery: http://127.0.0.1:3001/booking
- Payment status: http://127.0.0.1:3001/payment (use the booking's original browser; capability access remains required).
- Staff sign-in: http://127.0.0.1:3001/staff/login
- Payment administration: http://127.0.0.1:3001/admin — **Payment operations** panel.

The running `payment-app.mjs --mock` preview strips Paystack/Manus credentials, verifies the owned local database and displays an unmistakable simulation banner. It collects no card information. The ordinary `app.mjs` launcher keeps payments disabled. Keep the existing MySQL instance running. Rebuild before restarting if source changes; only one application may own port 3001.

**Not yet authorized or executed:** any Paystack test API request. A separate approval and private configuration of `PAYSTACK_SECRET_KEY` (`sk_test_...`) and `PAYSTACK_PUBLIC_KEY` (`pk_test_...`) are needed. Do not send values in chat. `SOUTHSIDE_PAYMENTS_MODE=test` and the explicit `PAYSTACK_TEST_NETWORK_APPROVED=1` gate must only be configured after that approval, with the owned local database and correct callback origin. No test-network launcher or publicly reachable webhook endpoint has been configured. A separately approved secure test webhook route/tunnel, test dashboard callback/webhook settings, and provider-supported fictional customer email/fixtures are required for an actual provider walkthrough. The current `example.invalid` fixture restriction is intentional; any adaptation must preserve the new-fictional-record boundary.

Provider connectivity, real test checkout, hosted-page mobile behavior, webhook delivery/retries from Paystack, settlement/reconciliation exports, unsafe-large-number provider-ID handling and operational recovery need genuine test-mode evidence. Uncertain initialization and review flags currently require separate investigation; there is no automatic reset, refund or override. No refund/dispute policy or automatic hotel confirmation rule was introduced.

Live payments remain unsupported by these gates. Before a later live phase: explicitly approve business/accounting rules, complete approved test-provider verification and discrepancy/refund/dispute handling, configure audited credential/HTTPS/webhook operations, and independently verify production schema compatibility. None of this report authorizes production access, credentials, migrations or deployment.

Original missing media and disabled notification delivery remain as documented in Phase 7. This phase did not replace photographs, enable email/WhatsApp delivery or change the existing website's design/navigation/content.

Unrelated browser observation: the existing Recent reservations table still presents raw JavaScript date/time strings, including the machine timezone, rather than hotel date-only labels. The payment changes do not modify those dates or that existing table. This presentation issue remains separate from the verified payment receipt and accounting flows.
