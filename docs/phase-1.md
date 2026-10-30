# Phase 1: access diagnostics and database readiness

No schema, migrations, role assignment rules, or production configuration changed.
The existing OWNER_OPEN_ID synchronization rule remains unchanged. Authentication
now reloads the database user after synchronization, without supplying a role.

Anonymous requests to staff procedures receive UNAUTHORIZED; authenticated
non-administrators receive FORBIDDEN. Invalid/expired sessions receive UNAUTHORIZED
with a sign-in message. Database and OAuth failures receive SERVICE_UNAVAILABLE
with a generic message. Public procedures remain accessible when authentication
is unavailable, unless that procedure itself needs the unavailable service.

Internal diagnostic messages contain fixed categories only: invalid_session,
oauth_unavailable, database_unavailable. Original provider/driver errors, tokens,
cookies, user identities, and infrastructure details are not attached.

GET /api/health remains a process liveness check. GET /api/ready returns 200
with {"status":"ready"} only when all 13 mapped tables can be queried with
LIMIT 0; otherwise it returns 503 with {"status":"unavailable"}. Responses use
Cache-Control: no-store. This checks connection/schema readability, not migration
history, write permissions, data correctness, or the availability of OAuth.
It never runs migrations or writes records. Do not invoke it against production
without authorization. No database connection was made during implementation.

Offline verification:

- Node 24: `node --test tests/offline.test.mjs` (no dependencies needed).
- With already installed project dependencies: `pnpm test`, `pnpm check`,
  and `pnpm build`. Do not install dependencies or contact services merely to
  run these checks without authorization.

The Vitest access and database tests mock database operations and session/provider
boundaries. Actual login, browser rendering, and database readiness still need
verification in an authorized isolated environment. Existing booking inventory,
pricing, payments, physical rooms, and housekeeping limitations remain outside
this phase.

## Stabilization verification

Verified with Node 24.22.1 and the package.json-pinned pnpm 10.18.0.
The existing pnpm v9-format lockfile was installed frozen, with its existing
patches and approved build scripts. No package versions or lockfile entries
were updated. The workspace-local Corepack cache is ignored by Git.

Commands executed from the nested project, using PowerShell:

```powershell
$env:COREPACK_HOME = Join-Path (Get-Location) '.corepack'; corepack pnpm install --frozen-lockfile
$env:COREPACK_HOME = Join-Path (Get-Location) '.corepack'; corepack pnpm test
$env:COREPACK_HOME = Join-Path (Get-Location) '.corepack'; corepack pnpm check
$env:COREPACK_HOME = Join-Path (Get-Location) '.corepack'; corepack pnpm build
node --test tests/offline.test.mjs
```

The install, initial test startup, and initial build were blocked by sandbox
network/filesystem permissions. Identical commands were rerun with approved
access. Installation completed with all 747 locked packages, after registry
timeouts and retries. The first executable Vitest run had 52 passes and six
failures: five new JSX render tests needed the production automatic JSX runtime,
and one cold database-module import exceeded its test timeout. Corrected the
test configuration and moved cold imports into setup with a 20-second budget.
The identical full test command was then rerun successfully.

Final results:

- Complete Vitest suite: 8 files, 58 tests passed, exit 0.
- TypeScript `tsc --noEmit`: passed, exit 0.
- Production Vite + esbuild bundle: passed, exit 0 (1,719 client modules).
- Dependency-free Node suite: 14 tests passed, exit 0.

Tests exercise the actual tRPC admin procedures, denied requests avoiding the
database, auth.me failures, sanitized catalogue/dashboard failures, refreshed
owner synchronization, missing/expired sessions, mocked OAuth and database
failures, readiness handler bodies/status/cache headers, five admin page states,
and leap-year validation including 2100 rejection and 2400 acceptance.
External service and database boundaries were mocked; no application service
connections or database writes were performed.

Stabilization also corrected the room-drafts query bypassing the database error
sanitizer and the expired-session action being hidden by another loading query.
The readiness handler is now separately testable and fails closed if its probe
unexpectedly throws. Existing authorization and owner-role assignment rules
remain intact.

Files changed during stabilization:

- `.gitignore`: ignore the local Corepack cache.
- `server/db.ts`, `server/routers.ts`: sanitize room-draft query failures.
- `server/_core/index.ts`, `server/_core/readiness.ts`: wire the testable readiness handler.
- `client/src/pages/Admin.tsx`: prioritize errors over concurrent loading state.
- `vitest.config.ts`: use the production automatic JSX runtime in tests.
- `server/access.test.ts`, `server/database.test.ts`: extend offline failure coverage and stabilize import setup.
- `server/phase1.integration.test.ts`, `server/admin-page.test.ts`: add route/handler and rendered-state regression tests.
- `docs/phase-1.md`: record commands, results, and limitations.

No unrelated pre-existing test or typecheck failures were found. Existing build
warnings remain: the runtime `/api/platform/config.js` script is not bundled,
and the client JavaScript chunk exceeds 500 kB. Offline tests also emit expected
missing-OAuth-configuration and invalid-session diagnostics. None caused failure.

Real database readiness, live OAuth/cookie behavior, and browser interaction
still require an authorized isolated environment. Generated `dist/`, installed
`node_modules/`, and `.corepack/` are local artifacts. No migration, role change,
production configuration change, or deployment was performed.
