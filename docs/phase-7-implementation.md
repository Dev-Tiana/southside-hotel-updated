# Phase 7: independent media and booking reliability

## Scope and safeguards

This phase adds independent local media upload/storage, persistent booking submission identifiers and disabled guest/administrator acknowledgement workflows. No live provider or payment service is contacted. No staff account is created or promoted. Existing hotel content, layouts, original media references, room rates, reservation snapshots, assignments and commitments remain.

The owner explicitly approved migration 0004 for both isolated local schemas. Before application, the complete journal/snapshot chain and SQL were reviewed; the guarded runner verified the owned MySQL instance, all prior migration hashes/order and conflicting table names. Both schemas now contain 25 application tables using InnoDB. No existing table was altered and no historical reservations, submission mappings or notifications were backfilled. See [review and impact](phase-7-migration-review.md).

The migration files are `drizzle/0004_booking_reliability.sql`, `drizzle/meta/0004_snapshot.json` and the appended journal entry. Foreign-key ALTER statements target only the two new tables. The schema adds `booking_submissions` and `booking_notifications` with unique constraints and NO ACTION references to reservations. Existing migration files 0000–0003 remain unchanged.

## Original hotel media

All **13 referenced originals remain missing**: twelve photographs and one MP4. [The original-media inventory](phase-7-original-media.md) documents every exact URL, expected checkout location, placement, and known repository source lead. Eight generated-path room images and the exact video binary have no recoverable source mapping in this checkout. Social source leads are unverified; they are not a replacement for hotel-owned originals and permission.

No photograph or video was generated, scraped or substituted into an original placement. Original `/manus-storage/` requests remain sanitized 404s until approved exact originals are supplied. The logo remains intact. Restoration or new media binding to an existing placement requires a reviewed file-to-placement mapping and approval.

## Independent upload/storage

Administrator-only upload and preview endpoints use the existing independent staff session and origin checks. Authentication/authorization occurs before buffering any upload. File size limits are 10 MiB for photographs and 50 MiB for MP4, with at most two concurrent upload bodies per application process.

Allowed types are JPEG, PNG, WebP and MP4. Validation checks MIME/filename agreement, signatures, bounded container/frame structure, truncated/trailing data, image dimensions and safe names. PNG also checks chunk CRCs and bounded decompression. Animated PNG/WebP, SVG, scripts, HTML, unsafe path filenames and unsupported formats are rejected. PNG support is explicitly limited to non-interlaced 8-bit grayscale/RGB formats. JPEG/WebP/MP4 checks are structural checks, not full codec decoding, transcoding or antivirus scanning. Extended-size MP4 boxes and unsupported brands are rejected with a meaningful error.

Files receive random UUID names; client filenames never select a disk path. `SOUTHSIDE_MEDIA_ROOT` must be an absolute private directory outside both web roots, without a symlink/junction escape. The local launcher selects `.local/media-development`; integration tests select `.local/media-integration`. New files use restrictive POSIX modes where supported; Windows deployments must use an application-owned directory with suitable NTFS ACLs. Do not put this directory in a public static tree.

New media records use the existing `media_assets` table and start private/unresolved. The administrator can inspect a protected preview and explicitly acknowledge rights/reason to publish the new upload. Existing non-managed media cannot be published through this endpoint. There are no replacement, overwrite, unpublish or deletion endpoints. The new `/hotel-media/<UUID>.<extension>` URL is not automatically attached to a category or original placement.

Public serving requires a published/approved database record, safe generated key, regular file, matching size and streamed SHA256 integrity check. Public responses have correct MIME, `nosniff`, a sandbox CSP and same-origin resource policy; the server supports range requests. Private previews are administrator-only and `no-store`. Original storage paths and private directory listings are not exposed.

File persistence and database metadata cannot form one filesystem/MySQL transaction. A failed database/audit write removes only that upload's newly generated uncommitted file. A hard process crash can leave a private orphan; no automatic orphan deletion was added. Backup, disk quotas, malware scanning/transcoding and retention need an operational policy before production use.

Legacy Manus helpers remain in `server/storage.ts`, `_core/storageProxy.ts` and optional AI/platform modules. They are not used by these upload, booking or acknowledgement workflows. The legacy owner-notification router now returns delivery-disabled information instead of calling Manus. No new storage account or external credentials are needed for this local filesystem driver.

## Persistent booking submission and recovery

The guest UI persists a random UUID before sending the reservation. It stores only identifiers and a SHA256 booking-intent fingerprint, not guest contact fields. Web Locks serialize matching intent creation across tabs. Missing/denied persistent storage or unsupported browser locking fails visibly before any reservation is sent.

The server normalizes UUID case and hashes the identifier. Its canonical request fingerprint covers category, dates, room/guest counts, normalized guest details and any hold token. A matching retry returns the existing reservation's current saved status and totals before availability, date eligibility or category activation checks. Reusing an identifier for different details is rejected. Different identifiers represent distinct requests; legacy API calls that omit identifiers retain backwards compatibility and do not have a retry guarantee. The website always sends an identifier.

The unique mapping, guest, reservation, audit/history and two outbox rows are committed in the existing category-locked MySQL transaction. A failure rolls everything back. The global identifier constraint also prevents two records when the same identifier races across different categories. Existing availability and price recalculation safeguards remain; no browser total is trusted.

Receipt recovery is a POST using the high-entropy identifier and returns only a minimal receipt, never guest contact details. Treat that browser-held identifier as a receipt capability; do not log or share it. Recovery performs no booking mutation and works after reload, sold-out inventory, elapsed stay dates or category closure. Unknown identifiers return no receipt; database failures remain service errors rather than false claims that no booking exists. The UI offers **Recover previous submission** before a guest starts a changed request.

## Acknowledgements and notifications

Each new reservation queues exactly two deduplicated entries: guest acknowledgement and administrator notification. They start **disabled**, with zero delivery attempts. Historical bookings are not modified or notified. Previews join the current saved reservation status, total and amount paid, so a pending request is never presented as confirmed.

There is no email provider adapter, network delivery worker or environment switch that can accidentally enable sending in this phase. The dashboard shows the disabled queue and previews. Owner notifications also remain disabled. The booking receipt explicitly reports the actual status and warns that email delivery is disabled. Payments and card collection remain inactive.

To enable delivery later, obtain explicit authorization for a provider, verify the sender identity/domain, configure the administrator recipient privately, and implement/review the adapter, worker locking, retry/backoff, provider idempotency, bounce/suppression handling and delivery monitoring. Reserved outbox states are not evidence of a completed delivery implementation. No provider credentials are requested or displayed here.

## Verification performed

All commands ran from the nested project, with the existing pinned pnpm through Corepack and existing dependencies. No dependency was installed or upgraded.

| Command | Actual result |
| --- | --- |
| `corepack pnpm exec drizzle-kit generate --name booking_reliability` | Offline generation only, with an unusable loopback placeholder URL; no database connection. Reviewed output contains only the two new tables. Explicit InnoDB declarations added. |
| `node scripts/local/migrations.mjs` | Review-only chain validation passed. |
| `node scripts/local/phase7-preservation.mjs --capture` | Captured existing hotel-record and staff metadata fingerprints before applying the migration or creating development fixtures. |
| `node scripts/local/migrations.mjs --apply` | Applied the owner-approved additive migration to both guarded local schemas; no data inserted or backfilled. |
| `corepack pnpm test` | Final implemented-code run: **167 passed, 33 skipped**, 18 files passed and two real-database files skipped in offline configuration. |
| `node scripts/local/test.mjs --preserve-administrator` | **32 passed, one intentionally skipped** against isolated real MySQL. The administrator bootstrap-success test is excluded to avoid creating any privileged account. |
| `corepack pnpm check` | Passed TypeScript. |
| `corepack pnpm build` | Passed production client/server build. Existing non-module platform-script and large-chunk advisory warnings remain. |
| `node scripts/local/auth-http-check.mjs` | Passed real HTTP login/session/logout protection and ordinary-user denial, including new media/notification endpoints, anonymous upload 401, ordinary upload 403 and revoked-session upload 401. Only ordinary integration fixtures were created. |
| `node scripts/local/preview-check.mjs` | Passed public route/readiness, sample availability/pricing, fictional persistence, leap-date and anonymous administrator protection checks after the Phase 7 restart. |
| `node scripts/local/phase7-media-inventory.mjs` | Confirmed exactly 13 original references and all 13 missing. |
| `node --import tsx scripts/local/phase7-browser.mjs` | Actual desktop/mobile guest flow passed. Deliberately dropped a successful response after commit, retried the same intent, verified one reservation/two disabled notices, then reloaded and recovered the receipt despite full inventory. |
| `node --import tsx scripts/local/phase7-browser.mjs --admin` | Actual authenticated administrator browser checks passed for upload, private preview, publication, safe public headers/range serving, 413 oversize, 400 unsupported type, disabled notification previews and both viewport sizes. |
| `node scripts/local/phase7-preservation.mjs` | Passed after the browser booking: every pre-Phase-7 hotel-record and staff metadata fingerprint unchanged. |

An initial sandboxed TypeScript-loader attempt failed in `os.userInfo`; it was rerun with tool approval. Initial private audit-session probes timed out and are not counted as successful authentication checks. After the window was brought forward and the updated preview was running, a normal existing administrator session was verified with HTTP 200 before any upload action. The timeout cause was not established; it is not presented as an authentication defect. No credential, role or session bypass was used.

### Browser evidence and fictional records

Public review layouts passed at 1440px and 390px without horizontal overflow. Actual mobile submission created reference **SS0QJPTKSRO1**, two rooms/two nights, total **NGN 100,000.00**, paid **0.00**, **pending manual confirmation**, in the Phase 6 fictional category. Its dates were checked for pre-existing active reservations. It remains pending for inspection and consumes the category's two rooms for the fictional interval. No existing booking was amended, cancelled or repriced.

The lost-response test failed only the owned public browser's HTTP response after the server committed; it did not mock the server, authentication, pricing or database. Retry and subsequent receipt recovery returned the same reference. This is evidence for the otherwise difficult commit-succeeded/response-lost case.

Private evidence is ignored under `.local/`: `phase7-tests.log`, `phase7-mysql.log`, `phase7-typecheck.log`, `phase7-build.log`, `phase7-baseline.json`, `phase7-original-media.json`, `phase7-public-plan.json`, `phase7-public-results.json`, and desktop/mobile review/receipt screenshots. No credentials, staff cookies or raw submission identifiers are printed in those results.

Authenticated media browser status: **passed**. The normal existing administrator session created and reviewed new technical media record **ID 1** in the development schema: a one-pixel PNG explicitly labelled as a technical fixture, not a hotel photograph. Its public URL returned 404 before publication; its private preview returned 401 anonymously and decoded correctly for the administrator. Explicit publication made that new UUID URL readable with PNG MIME, `nosniff`, sandbox CSP and range support (206). Actual authenticated oversize and unsupported SVG requests returned 413 and 400. The disabled acknowledgement queue had zero delivery attempts. Both 1440px and 390px dashboard layouts fit their viewports. The audit browser remains signed in; the owner's other browser session was untouched.

The fixture was not attached to any category, homepage or original placement. It remains as local test evidence; no deletion was performed. Additional ignored evidence includes `phase7-admin-results.json`, desktop/mobile admin screenshots, and focused media/notification screenshots. Synthetic MP4 integration fixtures test container storage only; real video playback remains unverified until an approved original clip is available.

Focused mobile media, acknowledgement and receipt screenshots were visually inspected. The checks use desktop browser viewport emulation, not physical mobile hardware or a complete accessibility/touch audit. The final preservation check passed after upload publication and all browser actions.

## Changed files

- `drizzle/schema.ts`; `drizzle/0004_booking_reliability.sql`; `drizzle/meta/0004_snapshot.json`; `drizzle/meta/_journal.json`.
- `shared/operations.ts`; new `shared/submission.ts`.
- `server/management/domain.ts`, `repository.ts`, `service.ts`, `compatibility.ts`.
- New `server/bookingRecovery.ts`, `server/bookingNotifications.ts`.
- New `server/media/validation.ts`, `storage.ts`, `routes.ts`, `fixtures.ts`, `validation.test.ts`, `storage.test.ts`.
- `server/routers.ts`, `server/db.ts`, `server/_core/index.ts`, `server/_core/systemRouter.ts`.
- New `server/phase7.test.ts`; updated `server/management/management.test.ts`, `mysql.integration.test.ts`, `migration.test.ts`, `server/database.test.ts`, `server/admin-page.test.ts`.
- New `client/src/lib/bookingSubmission.ts`, `client/src/components/MediaPanel.tsx`, `NotificationsPanel.tsx`.
- `client/src/components/BookingWidget.tsx`, `client/src/pages/Admin.tsx`, `client/src/index.css`.
- `scripts/local/app.mjs`, `test.mjs`, `migrations.mjs`, `auth-http-check.mjs`, `audit-browser.mjs`.
- New `scripts/local/phase7-preservation.mjs`, `phase7-media-inventory.mjs`, `phase7-browser.mjs`.
- New `docs/phase-7-migration-review.md`, `phase-7-original-media.md`, `phase-7-implementation.md`; updated `docs/local-preview.md`.

## Local inspection

- Website: http://127.0.0.1:3001/
- Booking and receipt recovery: http://127.0.0.1:3001/booking
- Staff sign-in: http://127.0.0.1:3001/staff/login
- Media and acknowledgement controls: http://127.0.0.1:3001/admin

The local launcher keeps Manus and payment configuration disabled. Production configuration, production services and live records were not accessed. No deployment was performed. Any restoration/replacement of existing media, destructive cleanup or amendment affecting existing bookings still requires approval.
