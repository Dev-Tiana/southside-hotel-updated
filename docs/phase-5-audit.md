# Phase 5 local functional audit

## Outcome

The existing isolated MySQL application, server authorization, and implemented operational dashboard passed the checks below. Phase 5 does **not** establish feature completeness: category creation/editing/activation and a complete public browser reservation submission interface are missing. Payments are inactive and original hotel media is absent.

Only fictional local fixtures were created. No migrations were executed, privileged accounts created, credentials or roles changed, production services contacted, or deployment performed. A final preservation check confirmed every reservation that predated this audit and staff credential/role metadata remained unchanged.

## Browser URLs

- Homepage: http://127.0.0.1:3001/
- Rooms: http://127.0.0.1:3001/accommodation
- Room detail: http://127.0.0.1:3001/rooms/classic-room
- Availability: http://127.0.0.1:3001/booking
- Reservation management entry: http://127.0.0.1:3001/booking/manage
- Staff login: http://127.0.0.1:3001/staff/login
- Dashboard: http://127.0.0.1:3001/admin

The separate audit browser was signed in normally with the owner's existing account. Session persistence was verified across reload, followed by logout and a 401 response for protected access. Only that audit session was signed out; the owner's other browser session was not touched. Sign in normally again to inspect the dashboard.

## Feature results

| Area | Result and evidence |
| --- | --- |
| Authentication | Passed existing administrator session persistence and audit-browser logout/protected denial. Real HTTP tests passed ordinary-user login, administrator denial, origin protection, cookie flags, logout/replay denial, and retired OAuth handling. MySQL tests cover session expiration, revocation and persistent throttling. No administrator was created during testing. |
| Room categories | **Missing:** no category create/edit/activation mutation or dashboard controls. Existing category read/catalogue functionality remains. Public room content is largely static and is not an automatically synchronized database category editor. |
| Physical rooms | Passed dashboard creation of a fictional room, activation, reservation assignment and deactivation. Adding a physical room preserved the category-authoritative capacity rather than adding sellable inventory. |
| Rates and availability | Passed date-specific rate change through the dashboard and persisted availability checks. Saved reservation totals stayed unchanged until an explicit audited amendment. |
| Public reservations | Real public API submission persisted fictional reservation ID 2, reference SS7J9ATZS6GX; a browser-supplied total of 1 was ignored and the server calculated NGN 20,000. The reservation appeared in authenticated dashboard records. **Browser gap:** availability search and navigation work, but the room detail/booking interface has no guest submission form to finish a booking. A confirmation presentation page is not proof of persistence. |
| Status, amendments, history | Passed dashboard amendment of only the newly created Phase 5 reservation to three nights/NGN 32,500, assignment, confirmation, cancellation request and approved cancellation. Audit history was present. Original reservations were unchanged. |
| Housekeeping | Passed fictional room cleaning task creation, in-progress, completed and inspected states, including cleaning after maintenance release. |
| Maintenance | Passed dashboard block creation, reduction in availability by one, release and restoration of capacity. |
| Reconciliation and concurrency | Real MySQL integration tests passed transactional inventory/concurrent reservation checks, rollback, assignments, cancellation-request reconciliation safeguards, physical-capacity restrictions and pricing. No authoritative-capacity conversion was performed on existing development inventory. |
| Validation/persistence/errors | Passed leap-year/date validation, invalid stay HTTP 400 responses, server pricing and persistence. Unknown room slugs now show the existing 404 page. Anonymous administrator requests return 401; ordinary authenticated users return 403. |
| Responsive layouts | Public checks covered 10 routes at 1440px and 390px without horizontal overflow. Authenticated dashboard checks and screenshots passed at both widths, with operational form interactions exercised in the desktop viewport. This is not an exhaustive mobile touch/accessibility audit. |

The fictional Phase 5 reservation is now cancelled after its tested lifecycle. Its history is retained. The fictional physical room is inactive, maintenance is released, and the tested date rate was restored to NGN 10,000. No records were deleted to clean up the audit.

## Confirmed defects fixed

1. Invalid same-day, reversed and past availability stays now return meaningful BAD_REQUEST/HTTP 400 responses instead of generic server errors.
2. Missing `/manus-storage/` assets now return a sanitized 404 rather than successful SPA HTML. Existing assets are served before that fallback.
3. Scoped staff form rules prevent the public booking grid from compressing login fields to approximately 95px on desktop. Verified login inputs are approximately 540px desktop and 308px mobile. Operational fields also fit their panel. Public styling is preserved.
4. Unknown room slugs use the existing 404 page instead of silently displaying Classic Room.
5. Two expensive Argon2 test cases received 15-second budgets after initial parallel verification produced 5-second timeouts. Hashing strength and authentication behavior were unchanged. Final runs passed.

## Payments and original media

Thirteen unique referenced original media assets are absent: twelve photos and one video. The hotel logo is present. No unrelated replacement photos were added. Restore the hotel's approved originals at their referenced paths; the private inspection output lists those paths.

Payment behavior was inspected but not changed. Locally, initialization returned 503 with payment configuration unavailable, and an unsigned webhook returned 401. No Paystack transaction or live API call was made.

The payment skeleton needs a separately approved implementation: initialization accepts browser amount/reference/email rather than binding to a server-calculated reservation amount; webhook handling logs verified events without idempotent reservation/payment reconciliation; verification is not integrated into financial updates. Confirm webhook signing-key configuration: Paystack documents HMAC SHA512 using its secret key. Do not activate payments until these are addressed and test-mode reconciliation is verified. See [Paystack webhooks](https://paystack.com/docs/payments/webhooks/), [verification](https://paystack.com/docs/payments/verify-payments/) and [API keys](https://paystack.com/docs/developer-tools/api-keys/).

## Commands and actual results

All commands ran from the nested `southside-main` project. Package commands used the existing pinned pnpm through Corepack; no dependencies were installed or upgraded. For package commands, COREPACK_HOME was set to the project's `.corepack` directory.

| Command | Actual result |
| --- | --- |
| `corepack pnpm test` | Final run: 135 passed, 26 skipped; 14 test files passed, two database files skipped in the offline configuration. |
| `node scripts/local/test.mjs --preserve-administrator` | Real isolated MySQL: 25 passed, one skipped. The privileged bootstrap-success test was deliberately skipped to avoid creating any administrator, even transactionally. |
| `corepack pnpm check` | Passed TypeScript `tsc --noEmit`. |
| `corepack pnpm build` | Passed production client/server build. Existing warnings: non-module platform configuration script and large client chunk. |
| `node scripts/local/preview-check.mjs` | Passed local route/readiness, availability/pricing, persistence, leap-date and anonymous protection checks. |
| `node scripts/local/auth-http-check.mjs` | Passed real HTTP ordinary-user authentication/authorization and logout checks against integration fixtures. |
| `node scripts/local/phase5-development-check.mjs` | Created exactly one fictional public API reservation and verified server pricing. Guard prevents accidental duplicate creation. |
| `node scripts/local/phase5-development-check.mjs --verify` | Passed after dashboard operations: all pre-existing reservation rows and staff credential/role metadata unchanged. |
| `node scripts/local/phase5-browser.mjs --public` | Completed 20 route/viewport checks and captured protected-gate/public screenshots. |
| `node scripts/local/phase5-browser.mjs --login-only --before` | Recorded the original narrow login inputs for comparison. |
| `node scripts/local/phase5-browser.mjs --status` | Confirmed normal private sign-in reached the dashboard before authenticated testing. |
| `node scripts/local/phase5-public-flow.mjs` | Passed real public availability search/navigation; confirmed missing guest submission controls. |
| `node scripts/local/phase5-dashboard.mjs` | Passed authenticated persistence, both viewport checks, booking visibility, rooms, housekeeping, rates, amendment, assignment, cancellation lifecycle, maintenance, history and logout/protected denial. |
| `node scripts/local/phase5-inspection.mjs` | Confirmed invalid stay 400, inactive initialization 503, unsigned webhook 401 and missing media 404. |
| `node --check scripts/local/phase5-dashboard.mjs` (also browser, public-flow and development-check scripts) | Syntax checks passed. |

An attempted `git status --short` could not run because Git is unavailable in this shell. The changed-file inventory below comes from this audit's edits, rather than a claim that the entire workspace was previously clean.

Private evidence is under ignored `.local/`: `phase5-offline-tests.log`, `phase5-database-tests.log`, `phase5-typecheck.log`, `phase5-build.log`, `phase5-dashboard-results.json`, `phase5-admin-1440.png`, `phase5-admin-390.png`, `phase5-browser-results/`, `phase5-public-flow.json`, and `phase5-inspection.json`. These artifacts are local audit evidence, not production configuration.

## Changed files in this phase

- `server/routers.ts`: date-range client error classification.
- `server/_core/vite.ts`: safe missing-media 404 in development and built serving.
- `client/src/index.css`: scoped staff form sizing.
- `client/src/pages/StaffLogin.tsx`: dedicated staff form class.
- `client/src/pages/RoomDetail.tsx`: unknown-slug 404.
- `server/phase1.integration.test.ts`: invalid stay regression cases.
- `server/auth/security.test.ts`: Argon2 test time budget.
- `server/auth/mysql.integration.test.ts`: test time budget and optional privileged-test exclusion.
- `server/management/mysql.integration.test.ts`: amendment snapshot/stale revision and cancellation/reconciliation coverage.
- `scripts/local/test.mjs`: explicit preserve-administrator test mode.
- `scripts/local/phase5-browser.mjs`: owned-browser responsive inspection.
- `scripts/local/phase5-dashboard.mjs`: authenticated fictional-fixture UI audit.
- `scripts/local/phase5-development-check.mjs`: guarded fictional booking/preservation checks.
- `scripts/local/phase5-inspection.mjs`: media and inactive payment inspection.
- `scripts/local/phase5-public-flow.mjs`: actual public availability flow inspection.
- `docs/phase-5-audit.md`: this report.
- `docs/local-preview.md`: current Phase 5 report pointer.

No migration files, dependency manifests, lockfiles, administrator setup configuration or payment code changed.

## Remaining work and approval boundaries

Implement category administration and complete the guest submission UI before describing the whole hotel website as functionally complete. Restore approved original media. Broaden mobile touch, keyboard and accessibility testing beyond the viewport/form checks performed here.

Any payment behavior changes, destructive database operations, or reconciliation/amendments affecting pre-existing reservations require explicit approval first. None were needed for the fixes in this phase. Production compatibility, deployment, real credentials and live payments remain outside this local verification.
