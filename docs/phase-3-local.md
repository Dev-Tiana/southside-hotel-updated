# Phase 3: isolated Windows development environment

## Browser access

- Website: **http://127.0.0.1:3001/**
- Rooms: http://127.0.0.1:3001/accommodation
- Room detail: http://127.0.0.1:3001/rooms/classic-room
- Booking: http://127.0.0.1:3001/booking
- Protected staff entry: http://127.0.0.1:3001/admin

The built application runs locally on loopback; this is not a deployment. Use
invented names, email addresses and phone numbers in all forms. Booking requests
write to the isolated development schema, not a live hotel system. Sample rates,
inventory and booking terms are fictional. No payments are enabled.

Public layouts/routes/content/styles remain intact. Database catalogue entries
are visibly labelled LOCAL SAMPLE. The existing photos/video under
`/manus-storage/` are absent from this checkout; approved original asset files
are still required for the complete visual experience. HTTP route checks do not
constitute browser rendering or visual acceptance tests.

The administrator dashboard remains protected. Its operational forms cannot be
inspected interactively until legitimate development authentication and an
explicitly authorized development staff identity are available. No administrator
account, role promotion, mock session or authentication bypass was created.

## Software and isolation

Inspection found XAMPP **MariaDB 10.4.32**, which does not meet the approved
MySQL 8+ compatibility target. No usable MySQL service, Docker/Podman installation
or WSL distribution was confirmed. XAMPP was left untouched.

The simplest available option was Oracle's portable **MySQL Community 8.4.13 LTS
Windows x64 ZIP**. It requires no Windows service, Docker, WSL or system-wide
installation. Existing Visual C++ runtime DLLs were present. Node 24.22.1 and the
existing pinned pnpm 10.18.0/dependencies were reused; package.json and the lockfile
were not changed or upgraded.

Official package documentation: https://dev.mysql.com/doc/refman/8.4/en/windows-choosing-package.html

Archive: https://cdn.mysql.com/Downloads/MySQL-8.4/mysql-8.4.13-winx64.zip

The downloaded archive was verified against the official published size
281154912 bytes and MD5 `7b94489d5524dea9b27097068bea25a8` before extraction.
The initial download timed out and was resumed; the extracted binary independently
reported 8.4.13.

Everything is under ignored `.local/`: portable binaries, data directory,
generated private credentials, logs and migration review hashes. Do not commit,
upload or share this directory. Credentials are generated locally, never printed
or requested in chat. Keep it under this Windows user's private profile.

- MySQL TCP: **127.0.0.1:3307**, InnoDB, UTC, utf8mb4; MySQL X disabled.
- `southside_development`: browser preview and fictional sample data.
- `southside_integration`: disposable fictional integration fixtures, separate
  from browser data. Tests retain their sample audit history; no automatic reset.
- Schema owner: DDL privileges limited to those two schemas.
- App account: SELECT/INSERT/UPDATE/DELETE on development only.
- Test account: SELECT/INSERT/UPDATE/DELETE on integration only.
- No account grants application administrator privileges.

Helpers refuse an unrecognized configuration, foreign datadir, occupied startup
port or incompatible server. No remote database URL is accepted by the local
launchers. Both test runner and integration suite independently check ownership.
The app launcher removes inherited Manus, owner-promotion and payment settings
and prevents loading the project's normal `.env`; it keeps login unconfigured.

## Migration review and execution

The complete history was inspected before execution, including journal order,
linked snapshot IDs, SQL table definitions, foreign keys and file hashes:

1. `0000_initial_users.sql`: users table and unique identity, ordinary-user default.
2. `0001_mushy_sentry.sql`: 12 original hotel domain tables and their constraints.
3. `0002_phase2_operations.sql`: six InnoDB operational tables, indexes/foreign
   keys, and nullable `inventory_blocks.releasedAt` on the existing table.

There are no table drops, record deletions, reservation rewrites, data imports,
payment changes or automatic user seeds in these migrations. No new migration
files were needed in Phase 3. Each owned empty schema received the three existing
migrations: **19 application tables plus `__drizzle_migrations`, all InnoDB**.
A subsequent run verified matching hashes/order and **zero pending migrations**.

The runner refuses nonempty untracked schemas, unknown tables and mismatched
history. MySQL DDL is not fully transactionally reversible; an interrupted or
partially applied migration requires manual review, never an automatic reset.
Production compatibility, schema state and cancellation reconciliation remain
unverified. These local results do not authorize production migrations.

## Fictional samples and real verification

The development seed created eight categories matching existing room slugs,
three fictional physical rooms per category, category-authoritative capacity of
three, invented rates and explicitly local-only terms. It created one ordinary
FK fixture actor without a Manus identity/session. Empty-category reconciliation
was recorded explicitly; there were no existing cancellation requests. A real
HTTP booking check subsequently created one fictional pending-manual-confirmation
reservation at a server-calculated NGN 20,000 total despite a supplied total of 1.
The seed is idempotent and refuses unmarked nonempty development data.

Executed checks:

- Complete ordinary Vitest suite: **118 passed**, 10 opt-in DB cases skipped.
- Opt-in real MySQL suite: **10 passed**, including a second successful run after
  graceful restart. Last-room concurrent reservations,
  active/expired holds and consumption, cancellation-request inventory,
  nightly override pricing and immutable saved totals, concurrent room assignment
  collisions and adjacent stays, housekeeping sequencing and dirty-room check-in
  denial, checkout cleaning, maintenance-vs-booking races/release, atomic rollback
  after an injected audit failure, all-InnoDB readiness, anonymous/ordinary-user
  administrator denial with a real stored ordinary fixture actor.
- TypeScript: `tsc --noEmit` passed (project config excludes test files).
- Production build passed. Existing non-module platform-script and >500 kB chunk
  warnings remain; no new build failure.
- Local HTTP checks passed: public route shells, safe ready response exactly
  `{"status":"ready"}`, sample availability/pricing, fictional reservation
  persistence, invalid non-leap date rejection, administrator APIs returning 401.
  Existing offline tests cover valid leap years and session/authentication failures.
- Graceful database stop/start verified. The first shutdown implementation failed
  safely because root TCP login was unavailable; it was replaced with MySQL's own
  Windows graceful-shutdown event after ownership/PID/executable verification.
  No forced process kill or database privilege escalation was used. The helper's
  RemoteSigned execution policy is process-scoped; machine policy is unchanged.
- Seed rerun changed nothing; migration rerun had no pending migrations.

Integration operations call the service layer directly using ordinary fixture
IDs solely to satisfy audit foreign keys. This does not unlock router access.
Router tests independently deny that user access. Authentication-provider login
and authenticated browser administrator interactions remain untested locally.

## Commands and restart

Run from `<PROJECT_ROOT>` in PowerShell.
These setup/verification commands were executed (download resumed twice after
interruption; checksum was checked before extraction):

```powershell
curl.exe --fail --location --continue-at - --retry 3 --speed-time 90 --speed-limit 1024 --output .local/downloads/mysql-8.4.13-winx64.zip https://cdn.mysql.com/Downloads/MySQL-8.4/mysql-8.4.13-winx64.zip
curl.exe --silent --show-error --fail --location --continue-at - --retry 3 --output .local/downloads/mysql-8.4.13-winx64.zip https://cdn.mysql.com/Downloads/MySQL-8.4/mysql-8.4.13-winx64.zip
Get-FileHash .local/downloads/mysql-8.4.13-winx64.zip -Algorithm MD5
Expand-Archive .local/downloads/mysql-8.4.13-winx64.zip -DestinationPath .local
& .local/mysql-8.4.13-winx64/bin/mysqld.exe --no-defaults --version
node scripts/local/migrations.mjs
node scripts/local/mysql.mjs init
node scripts/local/mysql.mjs status
node scripts/local/migrations.mjs --apply
node scripts/local/seed.mjs
node scripts/local/test.mjs
$env:COREPACK_HOME = Join-Path (Get-Location) '.corepack'
corepack pnpm test
corepack pnpm check
corepack pnpm build
node scripts/local/app.mjs
# In another terminal:
node scripts/local/preview-check.mjs
node scripts/local/mysql.mjs stop
node scripts/local/mysql.mjs start
```

Do not rerun `init` against existing data: it refuses to overwrite it. For normal
use after restarting Windows, run only `mysql.mjs start` and `app.mjs`; the app
stays in the foreground and Ctrl+C stops it. Stop the app before stopping MySQL.
Use `mysql.mjs status` first if unsure whether it is already running. No Windows
service or automatic startup task was installed. No migration/seed runs on app
startup. `test.mjs` is opt-in and always targets the separate test schema.

The previous no-database preview on port 3000 was stopped. Use port **3001** now.

## Remaining configuration and approval

Per the user's decision, database preparation came first and login remains
protected. For legitimate dashboard access, a separate development Manus project
must supply `MANUS_PROJECT_ID`, `MANUS_OAUTH_API_URL`,
`MANUS_OAUTH_PORTAL_URL`, and `MANUS_JWT_SECRET` privately. Configure an approved
development callback and HTTPS origin compatible with existing Secure,
SameSite=None cookies; do not weaken cookie security. Keep `OWNER_OPEN_ID` unset.
The current launcher intentionally removes authentication configuration; change
that workflow only when development authentication setup is explicitly requested.

Any administrator role assignment needs explicit approval for the specific
development identity; none is authorized or performed here. Approved media export
is also still needed. No additional approval is needed to inspect the public
local preview or run the isolated tests. Production access, deployment, real
customer import and live payments remain outside this work.

## Changed project files

- `.gitignore`: ignore `.local/` runtime secrets/data/binaries.
- `server/_core/index.ts`: optional HOST binding; existing default unchanged.
- `server/management/mysql.integration.test.ts`: ten opt-in real-DB cases.
- `scripts/local/common.mjs`: private local configuration/ownership guard.
- `scripts/local/mysql.mjs`: guarded initialization/start/status/graceful stop.
- `scripts/local/stop-mysql.ps1`: verified Windows orderly-shutdown event.
- `scripts/local/migrations.mjs`: review, history/hash conflict guards and local apply.
- `scripts/local/seed.mjs`: isolated, fictional, ordinary-user-only fixtures.
- `scripts/local/app.mjs`: Windows local launcher with protected login/payments.
- `scripts/local/test.mjs`: isolated real-DB test launcher.
- `scripts/local/preview-check.mjs`: actual local HTTP booking/readiness/auth checks.
- `docs/phase-3-local.md`: this setup, execution and limitations report.
- `docs/local-preview.md`: current Phase 3 URL/state notice.

No website component, stylesheet, database schema or migration source was changed
in Phase 3. Production configuration and records were not accessed or modified.
