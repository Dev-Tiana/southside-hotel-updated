# Phase 6: categories and guest reservations

## Implemented

The existing Express/tRPC/Drizzle/MySQL application now has administrator category management and a complete guest reservation submission flow. The existing website shell, navigation, typography, original image references, contact features, management routes, rates and operational controls remain.

### Administrator room categories

The dashboard's **Room category management** panel supports creation, name, description, occupancy, bed configuration, amenities, verification, local image references with alternative text, activation/deactivation, and explicit category inventory reconciliation. New categories start inactive at zero capacity. Their URL slug is chosen at creation and stays fixed to preserve links.

Each write requires server administrator authorization and the existing authenticated mutation-origin protection. Staff and ordinary accounts cannot use these write endpoints. Inputs have length, type and range bounds; image references allow only safe local `/manus-storage/` or `/hotel-media/` raster paths. These controls reference existing hotel files; uploading media or connecting replacement storage is outside this implementation. No stock or unrelated hotel photography was introduced.

Edits use optimistic revision checks and the existing category row lock. Audit history records actor, reason and before/after values. Category and image changes roll back together if history cannot be saved. Occupancy cannot be lowered below committed current/future guest counts. Deactivation stops new selling without cancelling, repricing or reassigning existing stays.

Category capacity changes use the same transactional category lock as reservations. They require explicit reconciliation acceptance and an exact review of all cancellation request IDs. Capacity cannot fall below confirmed/pending commitments, cancellation requests, active holds or maintenance blocks. Physical inventory authority cannot be silently overridden; staff must use the existing explicit reconciliation workflow. Adding physical rooms still does not automatically increase category capacity.

Category image lists use namespaced rows in the existing `hotel_settings` table. No migration or new table was needed. Public catalogue, detail pages, homepage category cards and booking preferences now read active database categories; original editorial guide content and image references provide presentation defaults for existing categories. Empty catalogues and database failures are distinct states, not fabricated bookable IDs. Guide rates remain labelled as guide rates; actual stay prices come from the booking search and submission services.

### Guest booking

The booking widget now provides dates, guests, room quantity and category filtering; available category selection; per-room occupancy; first-night prices and full nightly breakdown; room/night quantities and total; guest name/email/telephone; a review step; current approved terms and privacy acknowledgement; submission; and an actual saved booking reference/status response.

The server recalculates prices and checks availability while holding the existing category transaction lock. A reviewed total or terms change is rejected before guest/reservation insertion so the guest must review again. Browser-supplied totals and snapshots remain untrusted. Pending requests retain inventory according to the existing policy. Double-click submission is guarded in the browser, while concurrent inventory allocation remains protected in MySQL.

The receipt is rendered from the successful server response and states **pending manual confirmation**, unpaid, and not yet confirmed. No payment is collected, no card fields are present, and no payment integration code changed. Guests are told to retain their reference because email delivery is not configured. A connection failure advises contacting the hotel before retrying; this phase does not add a persistent idempotency key for guest retries across reloads.

The existing `/booking/confirmation` presentation route remains available. The new authoritative receipt is shown inline after a successful database-backed submission; merely opening a confirmation URL does not establish a saved booking.

## Verification

Commands ran from the nested `southside-main` project using the existing locked dependencies and pinned Corepack/pnpm. No installation or upgrade occurred.

| Command | Executed result |
| --- | --- |
| `corepack pnpm test` | 145 passed, 29 skipped; 15 files passed, two real-database files skipped by the offline configuration. |
| `node scripts/local/test.mjs --preserve-administrator` | 28 passed, one skipped on the guarded isolated MySQL schema. The privileged bootstrap-success test was skipped deliberately; no administrator account was created. |
| `corepack pnpm check` | Passed `tsc --noEmit`. |
| `corepack pnpm build` | Passed client and server production build. |
| `node scripts/local/phase6-preservation.mjs --capture` | Captured fingerprints before development-browser booking writes; read-only. Refuses to overwrite its baseline. |
| `node scripts/local/phase6-preservation.mjs` | Passed: all pre-Phase-6 reservations and staff credential/role metadata unchanged. |
| `node scripts/local/phase6-public-browser.mjs` | Actual browser search, selection, guest details and review passed at 1440px and 390px; mobile submission persisted a real fictional reservation. Neither viewport overflowed horizontally. |
| `node scripts/local/phase6-admin-browser.mjs` | Passed actual authenticated dashboard creation, inventory reconciliation, rate setup, editing, activation, reload persistence and 1440px/390px layout checks. |
| `node scripts/local/phase6-public-browser.mjs --category-fixture` | Passed the new category's public detail page and complete browser reservation submission at its configured NGN 25,000 nightly rate, with desktop/mobile review checks. |
| `node scripts/local/phase6-category-state-browser.mjs` | Passed actual dashboard deactivation/reactivation and public visibility changes; its fictional reservation remained unchanged. |
| `node scripts/local/preview-check.mjs` | Passed local route/readiness, availability/pricing, fictional persistence, invalid leap date and protected API checks. |
| `node scripts/local/auth-http-check.mjs` | Passed real HTTP ordinary-user login, cookie protection, administrator denial including all new category endpoints, origin denial, logout/replay denial and retired OAuth handling. No privileged account created. |
| `node --check scripts/local/phase6-public-browser.mjs`, `node --check scripts/local/phase6-admin-browser.mjs`, `node --check scripts/local/audit-browser.mjs` | Syntax checks passed. |

New tests cover category input/path validation; authorization for anonymous/user/staff accounts; authenticated actor selection; stale edits; occupancy preservation; cancellation review; physical authority; holds/maintenance commitments; audit rollback; reviewed price/terms changes; new category persistence, images, editing and activation; public tRPC booking persistence; and a real concurrent capacity-edit/booking race. The complete suite also retains prior reservation concurrency, assignments, maintenance, housekeeping, expiration and pricing tests.

Initial verification found and resolved a missing dashboard test mock and room-card TypeScript assumptions that accepted only hardcoded catalogue literals. An initial sandboxed test launch failed before running because esbuild could not read parent directories; the suite was rerun with the necessary tool approval. These are not claimed as passing runs.

Existing build warnings remain: the platform configuration script lacks `type="module"`, and the client bundle exceeds the chunk-size advisory threshold. These did not fail the build. Original missing media from Phase 5 remains unresolved.

### Actual browser reservation and evidence

The mobile browser created fictional reference **SSPC3S20VN9F**, total **NGN 20,000.00**, amount paid **0.00**, status **pending manual confirmation**, against the existing local sample Classic category on a future two-night interval checked for pre-existing overlapping reservations. The record remains available for dashboard inspection; it was not deleted or automatically confirmed/cancelled. It consumes inventory for its fictional dates.

The authenticated dashboard walkthrough created **category ID 9, Phase 6 Fictional Garden Suite**, slug `phase6-fictional-1793135349639`, category capacity 2, default nightly rate NGN 25,000. It edited and activated the category, then verified persistence across reload. A second browser submission against that new category created reference **SSFBROGHMM-5**, total **NGN 50,000.00**, paid **0.00**, pending manual confirmation. Deactivation and reactivation were tested afterward without changing that reservation. The category remains active for inspection, with one remaining room for the fictional test stay. Its test image is a reference only; no hotel photo was invented or replaced.

Private audit evidence is ignored under `.local/`: `phase6-tests.log`, `phase6-mysql.log`, `phase6-typecheck.log`, `phase6-build.log`, `phase6-public-results.json`, `phase6-category-public-results.json`, `phase6-admin-results.json`, `phase6-category-state-results.json`, `phase6-categories-1440.png`, `phase6-categories-390.png`, `phase6-booking-1440.png`, `phase6-booking-390.png`, and reservation/staff metadata fingerprints in `phase6-baseline.json`. Booking screenshots reflect the latest new-category walkthrough. The initial mobile booking screenshot was visually inspected as well as measured.

Authenticated browser category testing completed after the owner's normal private sign-in in the separate audit profile. No session was injected, no login was bypassed, and no administrator was created. No credentials or cookie values were inspected. The audit session was left signed in for visual inspection; the owner's other browser session was untouched.

## Files changed in Phase 6

- `shared/categories.ts` (new): bounded category, image, revision and reconciliation inputs.
- `shared/operations.ts`: optional reviewed total and terms fields.
- `server/management/categories.ts` (new): transactional creation, guarded updates/inventory, media and approved terms reads.
- `server/management/domain.ts`: category metadata operations on the transaction unit.
- `server/management/repository.ts`: category and image-setting writes under the existing category lock.
- `server/management/service.ts`: richer availability/receipt data and reviewed total/terms checks.
- `server/routers.ts`: administrator category procedures, public catalogue media and approved booking terms.
- `server/management/management.test.ts`: offline category/booking safeguards and transaction double support.
- `server/management/mysql.integration.test.ts`: real category persistence, rollback and concurrency tests.
- `server/category-authorization.test.ts` (new): server permission and input/actor tests.
- `server/admin-page.test.ts`: new category hooks and administrator/staff rendering assertions.
- `client/src/components/CategoryPanel.tsx` (new): category and inventory forms with feedback.
- `client/src/components/BookingWidget.tsx`: complete search-to-receipt guest flow.
- `client/src/components/RoomCard.tsx`: support database-managed room presentation data.
- `client/src/hooks/useRoomCatalogue.ts` (new): database category presentation with original editorial defaults.
- `client/src/pages/Admin.tsx`: administrator category panel.
- `client/src/pages/Accommodation.tsx`: active database categories and explicit loading/error/empty states.
- `client/src/pages/RoomDetail.tsx`: database details/images and category-prefilled booking.
- `client/src/pages/Home.tsx`: active database category cards and explicit loading/failure/empty feedback.
- `client/src/pages/Booking.tsx`: updated submission-step guidance.
- `client/src/index.css`: scoped responsive booking review, receipt and consent styles.
- `scripts/local/audit-browser.mjs` (new): local owned-profile browser helper without credential/session access.
- `scripts/local/phase6-preservation.mjs` (new): read-only baseline/preservation checks.
- `scripts/local/phase6-public-browser.mjs` (new): real public browser booking walkthrough.
- `scripts/local/phase6-admin-browser.mjs` (new): protected, fictional category browser walkthrough.
- `scripts/local/phase6-category-state-browser.mjs` (new): deactivation/reactivation and commitment-preservation browser check.
- `scripts/local/auth-http-check.mjs`: real HTTP ordinary-user denial assertions for new category endpoints.
- `docs/phase-6-implementation.md` (new): this report.
- `docs/local-preview.md`: Phase 6 preview/report pointer.

No schema definitions, migration files, payment handlers, credentials, dependency manifests, lockfiles or production configuration changed. Integration tests retained fictional fixture history rather than using destructive cleanup.

## Local inspection and remaining requirements

- Homepage: http://127.0.0.1:3001/
- Categories: http://127.0.0.1:3001/accommodation
- Existing room detail: http://127.0.0.1:3001/rooms/classic-room
- New fictional category: http://127.0.0.1:3001/rooms/phase6-fictional-1793135349639
- Complete guest flow: http://127.0.0.1:3001/booking
- Staff sign-in: http://127.0.0.1:3001/staff/login
- Category controls/dashboard: http://127.0.0.1:3001/admin

For a new category: create it inactive, set its rate through Hotel operations, review commitments and explicitly reconcile category capacity, then activate it. All actions record audit history. Use fictional records only in this local environment.

Restore approved original hotel media separately. Image uploads/storage replacement, notifications, payment activation, persistent guest retry idempotency and production verification remain separate work. Any migration, destructive cleanup or amendment/reconciliation affecting pre-existing reservation commitments requires explicit approval; none was performed here. No production service was accessed or deployment made.
