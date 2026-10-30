# Local visual preview

> **Phase 8 update:** the running preview at **http://127.0.0.1:3001/** uses an
> explicit **local payment simulator**, with no Paystack connection or real funds.
> Guest status is at **/payment**; protected payment history is on **/admin**.
> Paying does not confirm a pending reservation. The normal `app.mjs` launcher
> keeps payments disabled; `payment-app.mjs --mock` starts the guarded simulator.
> See [Phase 8 verification and remaining requirements](phase-8-implementation.md).

> **Phase 7 update:** independent media controls, persistent booking retries and
> receipt recovery are available locally. Email delivery remains disabled. See
> [Phase 7 implementation](phase-7-implementation.md) and
> [missing original media](phase-7-original-media.md) for evidence and requirements.

> **Phase 6 update:** the complete guest request flow and administrator category
> controls are available at **http://127.0.0.1:3001/** and **/admin**. See
> [Phase 6 implementation and verification](phase-6-implementation.md), including
> completed category and guest booking browser walkthroughs.

> **Phase 5 update:** the current local URL remains **http://127.0.0.1:3001/**.
> See [Phase 5 audit](phase-5-audit.md) for actual browser/database test results,
> safe fixes, missing features and current media/payment limitations. Older notes
> below are historical; missing media now returns HTTP 404.

> **Phase 4 update:** use **http://127.0.0.1:3001/** and independent staff sign-in at
> **http://127.0.0.1:3001/staff/login**. Manus OAuth has been retired. See
> [Phase 4 authentication and setup](phase-4-authentication.md) for approved local
> migrations, tests and the explicitly authorized initial administrator process.
> Earlier preview notes below are historical.

> **Phase 3 update:** the current isolated MySQL-backed preview is
> **http://127.0.0.1:3001/**. The older port-3000 preview described below has been
> stopped. See [Phase 3 setup and verification](phase-3-local.md) for the current
> database, sample-data, restart and protected-authentication status. The remaining
> text records the earlier no-database preview.

The existing built application is served locally at:

- Website: http://127.0.0.1:3000/
- Protected staff entry: http://127.0.0.1:3000/admin

This serves the production bundle on the local computer; it is not a deployment.
The application is running without database or Manus credentials. No runtime
configuration files were created or edited, migrations executed, roles granted,
or production services contacted.

## What can be inspected now

Public page layouts, navigation, typography, room catalogue and detail pages,
facilities, gallery layout, about, Abraka guide, offers, FAQ, policies, contact
and booking forms, booking-request-change form, chat launcher, and the staff
sign-in gate. The booking confirmation route is a presentation page, not proof
of an accepted reservation. WhatsApp and social links lead outside the preview.

The hotel media referenced under `/manus-storage/` is not included in this
checkout. Only the hotel logo is present as a local raster asset. The local
server currently falls back to application HTML for missing media paths, so
hotel photos and video will not render. Approved media must be exported from
the original managed storage before the complete visual experience is available.
Keep the original relative paths under `client/public/manus-storage/`, rebuild,
and restart. Do not replace the approved visuals with fabricated placeholders.

## Verified service state

- `/api/health`: 200, `{"status":"ok"}`.
- `/api/ready`: 503, `{"status":"unavailable"}`.
- `auth.me`: anonymous.
- `admin.summary` and `operations.snapshot`: 401, `UNAUTHORIZED`.

The `/admin` HTML response is only the React application shell. It does not mean
administrator access is available. Private dashboard records and operational
forms remain behind the existing authentication and authorization checks.
Reservation searches/writes, contact/chat enquiry persistence, dashboard data,
room operations, rates, maintenance, housekeeping, holds, and amendments require
database/authentication setup. Payments remain unconfigured.

## Restart the existing local preview

After stopping the existing preview process, run from PowerShell:

```powershell
Set-Location '<PROJECT_ROOT>'
$env:NODE_ENV = 'production'
$env:PORT = '3000'
node dist/index.js
```

The `NODE_ENV=...` syntax in the package.json start/dev scripts assumes a Unix
shell; setting process environment variables explicitly above works on Windows
without editing package scripts. If source code or approved local assets change,
rebuild with the pinned package manager before restarting:

```powershell
$env:COREPACK_HOME = Join-Path (Get-Location) '.corepack'
corepack pnpm build
```

## Legitimate full dashboard setup

1. Provide an isolated local MySQL 8+ InnoDB environment. Neither Docker nor the
   mysql command-line client was found on PATH during this preview check.
   Follow `phase-2.md` for schema verification and the separately authorized
   migration/reconciliation procedure; no migrations were run for this preview.
2. Configure `DATABASE_URL` privately for that isolated database. Authentication
   updates sign-in metadata and can synchronize users, so it must never point
   at production for a visual preview.
3. Configure the legitimate development Manus project's `MANUS_PROJECT_ID`,
   `MANUS_OAUTH_API_URL`, `MANUS_OAUTH_PORTAL_URL`, and `MANUS_JWT_SECRET` privately.
   No secret values need to be shared in chat. Verify a registered development
   OAuth callback and an HTTPS origin compatible with the existing Secure,
   SameSite=None cookies. Cookie security must remain intact.
4. Sign in with an already-authorized staff identity whose administrator role
   exists in approved development data. Keep `OWNER_OPEN_ID` unset; this preview
   does not grant roles or use the legacy owner-promotion mechanism.
5. Verify `/api/ready`, authentication, denied ordinary-user requests, and the
   actual browser workflow before inspecting operations. Review and reconcile
   inventory explicitly before exercising new booking operations in the isolated
   database. Existing financial snapshots and histories must be preserved.

Until these prerequisites exist, the actual operational dashboard cannot be
opened legitimately. No mock session or authentication bypass was introduced.
