# Phase 2 operational management

## Scope and preservation

Compatibility target: MySQL 8.0+ with InnoDB. This is not a statement about
production. No database connection, migration execution, production record
change, payment configuration, or deployment is part of this implementation.

Existing routes, public content, branding, and dashboard panels remain. The
authenticated `/admin` dashboard gains an operations panel using its existing
tables, buttons, forms, and visual classes. Guest contacts, status history,
assignments, rates, tasks, maintenance, holds, amendments, and recent audit
events are available only through administrator-authorized procedures.

Existing reservation rows, agreed terms, rate snapshots, payment records, and
history are not backfilled or automatically repriced. New bookings use exact
integer-cent arithmetic and the active rate for each individual night, falling
back to one default rate. Missing/ambiguous/non-NGN/zero rates block booking.
Changing rates retires matching active rates and adds a new row; it never
reprices existing reservations. New bookings use explicitly approved terms
from `hotel_settings.approved_booking_terms`. New tax remains zero, matching
the existing system; no unapproved charges or discounts are introduced.

## Additive migration

`drizzle/0002_phase2_operations.sql` and `drizzle/meta/0002_snapshot.json`, with
the corresponding journal entry, add six InnoDB tables:

- `physical_rooms`: hotel-supplied labels, active state, housekeeping state.
- `inventory_policies`: explicit reconciliation, capacity authority, reviewer.
- `room_assignments`: optional assignments with retained release history.
- `housekeeping_tasks`: staff assignment and ordered cleaning/inspection states.
- `room_maintenance`: links each physical maintenance job to one inventory block.
- `reservation_amendments`: full before/after financial and stay snapshots.

The sole change to an existing table is nullable `inventory_blocks.releasedAt`.
No tables/columns are dropped, existing definitions replaced, records seeded,
or existing blocks released. The migration was generated locally from schema
files using a dummy connection URL; the generate command does not connect or
apply SQL. Its six CREATE TABLE statements explicitly declare ENGINE=InnoDB.
Existing engine conversion is deliberately absent and requires separate review.

## Inventory and concurrency

Category `sellableInventory` remains the initial capacity. Entering physical
rooms does not change it. Switching to physical authority requires an explicit,
audited reconciliation checking all future commitments. Active room counts
cannot change while physical authority is enabled: reconcile to category mode,
change active rooms, and explicitly reconcile to physical mode again. Physical
count drift fails closed, but the review interface remains accessible.

Every operational writer, including public booking creation, uses the same
category row lock inside a READ COMMITTED, read/write transaction. Related
inventory is read with locking reads after that lock. The capacity calculation
uses half-open date intervals and peak simultaneous usage, including confirmed,
pending-payment, pending-manual, checked-in, and cancellation-requested bookings;
unexpired active holds; and unreleased inventory blocks. Non-overlapping stays
are not incorrectly summed across the whole search period. Assignments never
subtract category inventory a second time. Maintenance subtracts its linked
block exactly once. Hold-to-reservation conversion consumes the hold atomically.

Physical assignment conflicts and maintenance overlap are checked under that
same lock. All requested rooms cannot be exceeded by assignments. Cross-category
IDs and inactive rooms are rejected. Assigned rooms must be clean at check-in;
assignments remain optional, preserving category-only legacy reservations.
Checkout releases assignments and creates/reopens an audited cleaning task.
Maintenance release also requires cleaning. Existing task notes remain intact.
Housekeeping progresses open -> in progress -> completed -> inspected.
Legacy category blocks can be released explicitly with a reason, retaining
their original dates, quantity, creator, and description. Linked physical-room
blocks must use the maintenance-job release, so cleaning cannot be bypassed.

Operation, status history, amendment snapshot, and audit writes share the same
transaction. Failed auditing rolls back the operation. There are no independent
unlocked inventory writers in the application. External tools/direct SQL must
adopt the locking protocol or be excluded while operational booking is enabled.
Lock failures fail closed; no uncertain financial operation is automatically retried.
Unresolved checked-in stays past their booked departure also block new allocations
pending staff review. Their dates and prices are never silently extended. The
review panel and explicit checkout operation remain accessible.

## Safe cancellation-request reconciliation plan

The migration inserts no inventory policy rows. A category cannot accept new
bookings, holds, maintenance, assignments, or consuming status transitions until
staff explicitly review and reconcile it. Searches omit unreconciled categories
and retain the hotel's direct-enquiry fallback. Existing records are not changed
by this gate. Cancellation approval remains available to resolve an approved
request; financial records are not refunded or overwritten by cancellation.

Before any authorized activation against existing data:

1. Obtain an approved backup and isolated restoration. Verify migration baseline,
   actual version/engines, date/decimal decoding, timestamp/timezone consistency,
   and transactional privileges. Do not infer compatibility from documentation.
2. During an approved maintenance window, stop old application instances and
   external inventory writers. An older version does not honor these locks or
   cancellation rules. Do not allow mixed-version writers during rollout.
3. Review every existing `cancellation requested` row, including references,
   dates, quantities, paid amounts, pending guest correspondence, and original
   status history. Keep requests inventory-consuming pending staff approval.
4. Review all dated commitments, holds, existing maintenance blocks, and actual
   category capacity. Produce a peak-usage conflict report (the panel displays
   peak commitments). Resolve any conflict through owner-approved, explicit,
   audited actions. Never automatically cancel, fabricate capacity, assign
   physical rooms, reprice, or refund a legacy booking.
5. Submit `inventory.reconcile` with exactly the current cancellation-request
   IDs, capacity source `category`, and a review reason. The server locks the
   category, rechecks the request set and future peak usage, and rejects stale
   or insufficient-capacity reviews. The policy and audit commit together.
6. Only after category operation is validated, optionally enter verified physical
   rooms and explicitly reconcile to physical capacity. Unassigned reservations
   still consume capacity. Do not infer physical room labels from public cards.

Existing contact-form cancellation requests remain correspondence; they do not
silently change booking status. Authorized staff review them and perform the
explicit reservation status operation.

## Reservation amendments and administration

All operations validate input and use the authenticated administrator's ID.
The browser cannot choose the actor or bypass authorization. Status changes
follow explicit allowed transitions and record status history and audit notes.
No action marks a payment paid or alters a payment record.

An amendment is an explicit action with a reason and a server-issued revision
fingerprint. It rejects stale full reservation state, reprices the new stay on
the server, preserves amountPaid and agreed terms, stores full before/after
snapshots, and recalculates outstanding. Assignments must first be released
explicitly. Amendments of checked-in/completed/cancelled bookings, category
transfers, non-NGN repricing, and changes requiring refunds are blocked. These
require separate business/financial approval; no implicit conversion is offered.

## Readiness and real database verification still required

`/api/ready` remains a generic ready/unavailable response. Its internal checks
require all 19 tables/columns, MySQL 8+, and InnoDB engines. Operational
transactions also check compatibility, rather than assuming the target is met.
No infrastructure identifiers or driver errors are returned publicly.

Offline tests use a transactional in-memory repository for race/rollback tests,
and a mocked Drizzle adapter to verify category-first FOR UPDATE reads and
transaction isolation. These do not prove real MySQL isolation or SQL migration
execution. Before live use, an authorized isolated MySQL 8/InnoDB environment must:

- Apply migrations from an empty database and a sanitized existing baseline;
  verify no data/history/financial snapshot loss and correct foreign keys.
- Verify actual pool transaction pinning, row locks, READ COMMITTED behavior,
  deadlock rollback, lock timeouts, audit failure rollback, and connection loss.
- Race two independent database connections for the last unit, overlapping room
  assignments, maintenance vs booking, hold conversion/expiry, and amendments.
- Verify current timestamp interpretation, clock synchronization, Lagos date
  boundaries, decimal strings, nightly overrides, and capacity reconciliation.
- Test authenticated browser operation and responsiveness. Operational queries
  currently load complete category ledgers for correctness; measure large-ledger
  performance before launch and paginate the display independently of inventory.

Do not run the old code alongside new writers, execute migrations, connect to
production, or deploy based solely on the offline test results.

## Commands and changed files

The existing pnpm 10.18.0 installation and frozen lockfile were retained. No
dependency installation or upgrade was needed for Phase 2. Commands executed
from the nested project directory:

```powershell
$env:COREPACK_HOME = Join-Path (Get-Location) '.corepack'
corepack pnpm test
corepack pnpm check
corepack pnpm build
node --test tests/offline.test.mjs
```

Migration generation was a separate PowerShell process:

```powershell
$env:COREPACK_HOME = Join-Path (Get-Location) '.corepack'
$env:DATABASE_URL = 'mysql://offline:offline@127.0.0.1:1/offline_generation_only'
corepack pnpm exec drizzle-kit generate --name=phase2_operations
```

The dummy URL was process-local, not saved as application configuration. The
command generated SQL and metadata files only. Test and build commands used
approved filesystem access where esbuild required it; no server was started.

Changed/added source and documentation files:

- `drizzle/schema.ts`
- `drizzle/0002_phase2_operations.sql`
- `drizzle/meta/0002_snapshot.json`
- `drizzle/meta/_journal.json`
- `shared/operations.ts`
- `server/db.ts`
- `server/routers.ts`
- `server/management/domain.ts`
- `server/management/repository.ts`
- `server/management/service.ts`
- `server/management/compatibility.ts`
- `client/src/components/OperationsPanel.tsx`
- `client/src/pages/Admin.tsx`
- `server/management/management.test.ts`
- `server/management/repository.test.ts`
- `server/management/migration.test.ts`
- `server/management-authorization.test.ts`
- `server/database.test.ts`
- `server/admin-page.test.ts`
- `docs/phase-2.md`

Local ignored build outputs in `dist/` were regenerated. Package manifests,
lockfile, existing migration files, stylesheets, and public-page source files
were not changed.

## Executed verification results

Final verification after the audit-timestamp correction:

| Check | Actual result |
|---|---|
| Complete Vitest suite (`corepack pnpm test`) | 12 files, 118 tests passed; exit 0 |
| TypeScript (`corepack pnpm check`) | Passed; exit 0 |
| Vite + esbuild production build (`corepack pnpm build`) | Passed; exit 0; 1,793 client modules |
| Dependency-free Node suite | 14 tests passed; exit 0 |

The full suite covers per-date inventory, holds and expiry, cancellation gating,
maintenance accounting, physical-capacity reconciliation, simulated concurrent
bookings/holds/maintenance/assignments/amendments, transactional audit rollback,
nightly prices, exact cents and overflow, preservation of old prices/terms/paid
amounts, cleaning and inspection, check-in/checkout, past-due occupied stays,
every operational action's authorization, UI rendering, readiness, leap years,
and additive migration/snapshot preservation.

Expanded test runs initially exposed test-router setup and direct Zod-error
expectations; those were corrected. The overflow test also led to a clearer
server-side total-limit error. No unrelated pre-existing failures remain.
Existing non-failing build warnings concern the runtime platform-config script
and the client chunk exceeding 500 kB. Tests emit expected missing-OAuth-config
and invalid-session diagnostics, using no live OAuth connection.

Current request bounds are 1–365 nights for new/amended stays, at most five
rooms through the existing public API and twenty through staff creation. They
are technical request limits, not published hotel policies. Existing records
outside these limits are retained; legacy inventory calculations do not impose
the new-stay duration limit. Validate operational limits, approved terms, real
occupancies, rates, and taxes with the hotel before enabling real bookings.
