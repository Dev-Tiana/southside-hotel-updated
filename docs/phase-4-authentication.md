# Phase 4: independent staff authentication

## Current local application

- Website: http://127.0.0.1:3001/
- Staff sign-in: http://127.0.0.1:3001/staff/login
- Existing dashboard: http://127.0.0.1:3001/admin

The rebuilt application is running with independent authentication. No Manus
project, JWT secret, OAuth callback registration or network access is needed for
staff login. The old `/api/oauth/callback` returns HTTP 410. Manus JWT cookies,
bearer headers and scheduled/preview identity shortcuts cannot authenticate.

**The operator completed private setup and reported signing in to the dashboard.
Read-only verification confirmed one enabled administrator, completed setup, one
successful administrator login and one currently valid administrator session.**
No administrator or staff account was automatically created, promoted or linked.
The development credential table was verified empty before launching the
reviewed setup below. Integration fixtures have ordinary `user` permission;
the initial-administrator transaction test deliberately throws before commit and
rolls back, leaving no privileged credential or completed setup guard.

## Authentication and authorization

- Email is trimmed/lowercased and uniquely indexed. Existing users are never
  automatically linked by email. Historical Manus identity/role fields remain
  intact but do not authorize independent login.
- Passwords use asynchronous native Node Argon2id, version 19, **64 MiB memory,
  three passes, one lane**, random 16-byte salt and 32-byte output in PHC format.
  Passwords must contain 15–128 characters (at most 128 UTF-16 code units and
  512 UTF-8 bytes). Nothing truncates passwords. At most four derivations run
  concurrently per process. Unknown accounts perform the same expensive check.
- The installed **Node 24.22.1** supplies `crypto.argon2`; Node **24.7+ with this
  API** is required. No password package or other dependency was installed.
  package.json and pnpm-lock.yaml were unchanged.
- Random 256-bit opaque session tokens travel only in a host-only **HttpOnly,
  SameSite=Strict** cookie. Only SHA-256 token verifiers are stored in MySQL;
  neither password hashes nor tokens are returned in `auth.me` or login JSON.
- Sessions expire after **eight hours**, with a **30-minute server idle timeout**.
  Login rotates the browser's old session; logout revokes it in MySQL before
  clearing the cookie. Revocation failure returns a service error rather than
  falsely reporting successful logout. Disabled credentials are rejected on
  subsequent requests, and the current credential role is loaded from MySQL.
- Persistent, transactionally locked buckets limit login attempts to **10 per
  normalized email and 30 per peer IP per 15-minute window**. Unknown accounts
  count too. The IP bucket is checked first to prevent blocked peers from
  creating unlimited new email buckets. Forwarded-IP headers are not trusted.
- Login, logout and real session-authenticated tRPC mutations require an exact
  configured Origin; cross-site Fetch Metadata is rejected. Outside the explicit
  loopback mode, authentication mutations also require an HTTPS request.
- Authentication failures are generic; diagnostics contain fixed categories,
  never request bodies, tokens, cookies, passwords or underlying SQL errors.
  Successful/denied/throttled login, logout and initial setup record safe audit
  events. API responses use `Cache-Control: no-store`.
- No public registration or public initial-setup endpoint exists. There is no
  owner-email or `OWNER_OPEN_ID` promotion rule.

The role attached to `staff_credentials` is authoritative for the authenticated
context, rather than the historical `users.role` field. This avoids rewriting
existing user roles or expanding the original enum:

| Credential role | Dashboard/catalogue/operational reads | Operational mutations / owner notification |
| --- | --- | --- |
| user | Denied | Denied |
| staff | Allowed, read-only dashboard | Denied |
| admin | Allowed | Allowed after server authorization and origin checks |

The browser hides administrator operation forms from read-only staff. Server
checks remain authoritative. All existing operation validation and transactional
inventory controls remain in place.

Password/session guidance reviewed against [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
and [session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).
Native API: [Node crypto documentation](https://nodejs.org/docs/latest-v24.x/api/crypto.html#cryptoargon2algorithm-parameters-callback).

## Configuration and local cookie boundary

Independent authentication requires:

- `DATABASE_URL`: private database account URL, supplied by the owned local helper.
- `STAFF_AUTH_ORIGIN`: exact application origin, without trailing slash or path.
- `STAFF_AUTH_ALLOW_LOCAL_HTTP`: optional explicit `1` for loopback-only HTTP.

The preview launcher binds **127.0.0.1:3001**, sets the exact HTTP origin, and
explicitly enables loopback mode. Its cookie is HttpOnly/Strict with Secure=false
only for this local HTTP preview. Local authentication mutations also verify the
socket peer is loopback. No proxy header can enable this mode. Everywhere else,
cookies have Secure=true, the origin must be HTTPS and authentication mutations
require HTTPS. TLS termination/trusted-proxy design must be reviewed separately
before any non-local use; no production proxy settings were changed.

The local launcher strips inherited Manus, owner-promotion and payment settings
and does not load normal project `.env` files. The native session system needs
no JWT signing key or external identity provider.

## Reviewed and approved additive migration

The user explicitly approved applying the four-table migration to both owned
local schemas after review. `drizzle-kit generate` ran offline with a placeholder
connection URL; it made no database connection. Review compared the complete
0002 and 0003 snapshots and confirmed all 19 historical table definitions were
identical. The generated SQL was reviewed and explicit InnoDB added to each table.

`drizzle/0003_independent_staff_auth.sql` creates:

1. `staff_credentials`: unique user/email, Argon2id hash, independent role and enabled flag.
2. `staff_sessions`: hashed token PK, credential FK, absolute/idle/revocation timestamps.
3. `staff_auth_limits`: hashed bucket key, counter, window start.
4. `staff_auth_setup`: one-time setup guard, locked transactionally during bootstrap.

It adds only new-table foreign keys/indexes. There are no alterations to original
tables, data rewrites, identity links, user seeds or role grants. The migration
runner verified existing migration hashes/order and owned instance/datadir before
applying it to `southside_development` and `southside_integration` only. Both now
contain **23 application tables plus the migration tracker**, all InnoDB.

Before/after checksums confirmed identical record contents in all 19 historical
tables in both schemas immediately across migration execution. Subsequent tests
added only fictional integration fixtures. No production connection was made.
DDL is not generally rollbackable; the runner never resets partially migrated
schemas automatically.

## Secure initial administrator setup

Do not send an email/password secret in chat, place a password in command
arguments, or use a production password. The interactive helper:

1. Requires the operator to type **CREATE LOCAL ADMINISTRATOR** explicitly.
2. Prompts privately in Windows for a display name, local email and twice-hidden
   unique password. It sends the input to Node through anonymous stdin only.
3. Validates the owned local database/datadir and targets development only.
4. Locks the one-time setup row, refuses an existing administrator/completed
   guard, and refuses to link an existing email identity.
5. Creates a new ordinary historical `users` row for audit foreign keys and an
   explicitly authorized independent administrator credential in one transaction.
   It marks setup complete and records the authorization audit event atomically.
6. Prints only success/failure and the sign-in URL. It creates no login session.

After explicit authorization, run this in a **private interactive PowerShell
window** from the nested project directory:

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\scripts\local\admin-setup.ps1
```

RemoteSigned applies to this process only; it does not change machine policy.
Then open http://127.0.0.1:3001/staff/login and enter the credentials privately in
the browser. Successful login redirects to the existing dashboard. Sign out
using its new Sign out control; reopening `/admin` should return to the gate.
Do not rerun setup as a recovery/reset procedure: it intentionally refuses.

Running `node scripts/local/admin-setup.mjs` without authorization was actually
tested and refused before creating an account. The operator subsequently
completed private setup and confirmed dashboard sign-in. Session validity and
the successful login audit were verified read-only; the browser interaction was
not automated. Do not run initial setup again.

## Executed verification

| Command | Result |
| --- | --- |
| `corepack pnpm exec drizzle-kit generate --name independent_staff_auth` | Offline generation succeeded; reviewed four-table migration |
| `node scripts/local/migrations.mjs` | Review only, no connection |
| `node scripts/local/migrations.mjs --apply` | Approved migration applied to both owned local schemas |
| `.local/preservation-check.mjs before` and `after` | All 19 historical tables unchanged across migration in both schemas |
| `corepack pnpm test` | **132 passed**, 24 opt-in real-DB cases skipped; 14 files passed, two DB files skipped |
| `node scripts/local/test.mjs` | **24 passed**, two real MySQL suites: 14 authentication and 10 hotel operations |
| `corepack pnpm check` | Passed, `tsc --noEmit`; project configuration excludes tests |
| `corepack pnpm build` | Passed; existing non-module platform-script and large-chunk warnings remain |
| `node scripts/local/auth-http-check.mjs` | Passed against a separately spawned loopback test server using the integration schema; temporary ordinary credential disabled afterwards |
| `node scripts/local/preview-check.mjs` | Existing public routes, safe ready response, sample availability/pricing, booking persistence and anonymous administrator denial passed |
| `node scripts/local/admin-setup.mjs` | Correctly refused unauthorized setup; expected exit 1 |
| Malformed stdin supplied to the explicitly flagged setup CLI | Correctly refused with a fixed message and no echoed input; expected exit 1 |
| PowerShell parser check for `admin-setup.ps1` | Passed; private setup window subsequently launched after explicit user authorization |

Commands ran from the nested project using `$env:COREPACK_HOME = Join-Path
(Get-Location) '.corepack'` and pinned pnpm 10.18.0. The generation command used
`$env:DATABASE_URL = 'mysql://offline:offline@127.0.0.1:3307/offline_generate_only'`
as an offline placeholder; it was not a live credential or connection. The local
launchers supply their own private development/test URLs.

Authentication coverage includes password hash verification/random salts and
length limits; malformed hashes; no legacy cookie/bearer acceptance; generic
unknown/wrong/disabled-account denial; role separation and all administrator-only
operation denials for staff; origin/HTTPS/cookie policy; database failure
sanitization; absolute and idle expiration; disabling credentials; session
rotation/revocation/replay; concurrent persistent throttling; no automatic email
linking; completed setup guard refusal; rollback of privileged initial setup and
its audit. Real HTTP tests also cover the actual tRPC/Express cookie flow.

The first offline run had one failing outdated 19-table readiness assertion. It
was updated to 23; the complete suite was rerun and passed. No unrelated test
failures remain. Existing booking/inventory/concurrency/pricing/rollback,
assignment, housekeeping, maintenance and leap-year tests still pass. Website
stylesheet output retained the same asset hash; no stylesheet was edited.

## Remaining Manus dependencies to replace separately

Authentication is independent. The following optional service/media pieces
remain in source and were not configured or called over the network:

| Area | Source / behavior | Remaining work |
| --- | --- | --- |
| Hotel photos and video | `shared/hotel.ts`, `client/src/pages/Home.tsx`: `/manus-storage/...` paths; originals absent locally | Obtain approved originals and migrate to owned static/object storage while preserving paths/design |
| Managed storage | `server/storage.ts`, `server/_core/storageProxy.ts` | Replace presign/upload/download adapters; storage proxy currently not registered by the Express entrypoint |
| LLM, images, speech | `_core/llm.ts`, `imageGeneration.ts`, `voiceTranscription.ts` | Replace optional API integrations if these helpers are needed; current enquiry chat is not dependent on these for staff login |
| Data/map proxy | `_core/dataApi.ts`, `_core/map.ts`, `client/src/components/Map.tsx` | Select owned providers or direct maps integration; current public location panels/links remain intact |
| Owner notification | `_core/notification.ts`, admin-protected `system.notifyOwner` | Replace optional notification transport; unconfigured in local launcher |
| Scheduled platform jobs | `_core/heartbeat.ts` | Replace optional managed scheduler; no scheduled routes/jobs were added or configured here |
| Public platform config | `_core/publicConfig.ts`, `client/src/platform.d.ts`, `/api/platform/config.js`, Vite config | Only remaining optional API URL/browser key plumbing; authentication project/OAuth fields removed |

The Manus network/session-replay development debug collector and permissive
Manus development host allowlist were removed as part of protecting login data.
Browser bearer forwarding, OAuth SDK/routes/types/state helpers and owner
auto-promotion were removed. Old optional packages were not pruned or upgraded.

## Changed files

Database sources:

- `drizzle/schema.ts`
- `drizzle/0003_independent_staff_auth.sql`
- `drizzle/meta/0003_snapshot.json`
- `drizzle/meta/_journal.json`

New authentication implementation/tests:

- `server/auth/password.mjs`
- `server/auth/password.d.mts`
- `server/auth/security.ts`
- `server/auth/service.ts`
- `server/auth/security.test.ts`
- `server/auth/service.test.ts`
- `server/auth/mysql.integration.test.ts`

Server integration and updated regression tests:

- `server/_core/context.ts`
- `server/_core/trpc.ts`
- `server/_core/diagnostics.ts`
- `server/_core/index.ts`
- `server/_core/cookies.ts`
- `server/_core/publicConfig.ts`
- `server/_core/env.ts`
- `server/_core/vite.ts`
- `server/db.ts`
- `server/management/compatibility.ts`
- `server/management/mysql.integration.test.ts`
- `server/access.test.ts`
- `server/platform.test.ts`
- `server/auth.logout.test.ts`
- `server/database.test.ts`
- `server/admin-page.test.ts`
- `server/management-authorization.test.ts`

Retired files deleted:

- `server/_core/sdk.ts`
- `server/_core/oauth.ts`
- `server/_core/types/manusTypes.ts`

Frontend/configuration:

- `client/src/App.tsx`
- `client/src/main.tsx`
- `client/src/const.ts`
- `client/src/_core/hooks/useAuth.ts`
- `client/src/pages/Admin.tsx`
- `client/src/pages/StaffLogin.tsx`
- `client/src/platform.d.ts`
- `shared/const.ts`
- `vite.config.ts`

Local tooling/documentation:

- `scripts/local/app.mjs`
- `scripts/local/test.mjs`
- `scripts/local/migrations.mjs`
- `scripts/local/common.mjs` (sanitized malformed private configuration handling)
- `scripts/local/admin-setup.mjs`
- `scripts/local/admin-setup.ps1`
- `scripts/local/auth-http-check.mjs`
- `docs/phase-4-authentication.md`
- `docs/local-preview.md`

Generated binaries/builds, local review/checksum files, runtime credentials and
test helpers under ignored `.local/` are not source artifacts to publish.

## Outstanding requirements

- Initial administrator setup and browser sign-in were completed by the operator.
  Read-only server checks confirmed a valid session. Operational browser
  acceptance testing is described in [the dashboard checklist](dashboard-browser-test.md).
- Additional staff provisioning, password change/recovery, account administration,
  MFA and retention/cleanup jobs need separately reviewed workflows; no public
  reset/registration endpoint or automatic privilege grant was introduced.
- Before any external use: review HTTPS termination/trusted proxy handling,
  instance-wide throttling/deployment resources, backups and credential/session
  retention. No production services, configuration, records, payments or deployment
  were touched. Local verification does not establish production readiness.
