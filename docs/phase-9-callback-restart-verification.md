# Phase 9: callback-omission restart verification

## Authorized scope

Controlled private local restart and read-only local checks only. No booking creation, payment initialization, previous-attempt retry, authoritative provider verification, financial write, public webhook, deployment or production access is authorized by this stage. Do not disclose guest details, keys or payment reference values.

## Preparation completed

The built server artifact contains callback omission handling and the inspected guarded launcher forces `SOUTHSIDE_PAYSTACK_CALLBACK_MODE=omit` for its child process. Existing test-key, owned-development-database, loopback, fictional-booking and disabled-webhook gates remain in the launcher. The built artifact is newer than the launcher changes. This is artifact/launch-configuration evidence, not yet a newly restarted-process result.

Created `scripts/local/phase9-restart-preservation.mjs` from the existing read-only preservation helper. Its comparison requires exact equality of captured row membership and hashes, not just preservation of old IDs. It captures all existing rows in the established hotel/payment/history/audit/submission/notification tables, including all three unresolved attempts, plus staff identity/role/enabled metadata. It emits only pass/fail summaries. It never issues SQL writes or prints database row values. Private hashes are stored in ignored `.local/phase9-restart-preservation.json`, without overwriting an existing baseline.

Executed:

```powershell
node --check scripts/local/phase9-restart-preservation.mjs
node scripts/local/phase9-restart-preservation.mjs --capture
```

Syntax passed and pre-restart hashes were captured successfully against the owned isolated development database. No database record was changed by these commands.

## Restart status

The operator has been asked to close local payment/return tabs, press Ctrl+C in the existing private server window and wait for the PowerShell prompt, leaving MySQL running. Stop confirmation is pending. The last independent listener check still found the previous loopback server on port 3001; no second instance was launched or process terminated by the audit.

Update: the operator confirmed shutdown and the PowerShell prompt returned. The subsequent independent TCP listener check confirmed **no listening server on port 3001**. The operator has now been instructed to run the existing private helper's `Check`, then `Start` only after preflight passes. Fresh preflight/start results and post-restart checks are pending. No transaction or payment-control interaction is included in those instructions.

After stop confirmation, verify the listener is gone, then use the existing encrypted credential helper privately with `-Action Check` and `-Action Start`. Do not change execution policy, inspect credential contents or invoke `Diagnose`. The restart must use the inspected launcher and updated artifact.

## Pending checks after restart

- New process starts successfully after the current build timestamp through the approved helper, whose child environment explicitly selects omission.
- Safe readiness endpoint returns ready and public configuration returns enabled test mode. Public config does not expose callback mode, credentials or infrastructure details; do not claim it independently reports omission.
- Only a loopback listener exists; the disabled webhook route remains HTTP 404.
- Load homepage, room catalogue, booking page and staff login as ordinary document GET requests without cookies, booking submission or payment/return effects. Page HTTP responses do not establish a fully authenticated dashboard walkthrough.
- Execute `node scripts/local/phase9-restart-preservation.mjs` and require exact row-membership/hash comparison to pass.

No further automated suite or build is needed merely to restart the already-verified artifact. Existing offline results remain historical; no new test pass is claimed here. Readiness for another checkout must be reported after the pending checks; this restart approval does not authorize a transaction.

## Completed restart results

The owner reported successful private `Check` and `Start`. Independent checks then confirmed:

- Safe readiness response: `{"status":"ready"}`.
- Public payment configuration: enabled, mode `test`.
- Disabled webhook route: HTTP 404 for POST.
- One listener on port 3001, bound only to `127.0.0.1`, new Node process 21636. Its start time is later than the rebuilt artifact, and the previous listener was independently confirmed absent before restart.
- Reinspection of the launcher confirms its child environment explicitly forces callback mode `omit`; reinspection of the built artifact confirms it handles omission. Together with the owner-confirmed helper restart and new-process timing, this verifies the controlled launch uses the updated omission configuration. Public configuration does not independently expose that switch. No process environment, secret, initialization payload or provider traffic was inspected, and no real-wire omission claim is made.
- HTTP document responses passed for `/`, `/accommodation`, `/booking`, `/staff/login` and `/admin`: HTTP 200 with the SPA application root. Referenced JavaScript and CSS assets returned HTTP 200. These were ordinary requests without credentials/cookies and without executing browser payment effects. They do not constitute visual browser testing, authenticated dashboard access or proof of rendered category data. An exploratory GET to `/rooms` also returned the SPA shell, but `/accommodation` is the actual catalogue route and is the reported check.
- `node scripts/local/phase9-restart-preservation.mjs` **passed**: exact equality of pre-restart row membership/hashes across captured hotel, reservation, inventory, payment-attempt/event/ledger, booking history, audit and notification/submission tables, including all three unresolved attempts. Staff identity/role/enabled metadata is unchanged. No row was added, deleted or modified in those captured tables.

No startup error was reported or observed by the local readiness checks. No further suite/build was run; the artifact was already verified offline. No booking, initialization, verification, retry, settlement, database migration, provider call, public webhook or deployment occurred. Keys, guest information and payment references were not printed by this restart audit. New audit files are the read-only preservation helper and this report; the ignored private hash baseline is an additional local artifact. Application runtime source was not changed during the restart audit.

The local application is available at `http://127.0.0.1:3001/`; catalogue `/accommodation`, booking `/booking`, staff sign-in `/staff/login` and dashboard `/admin`. Existing administrator login remains required. Do not open payment-return routes or use payment controls without separate authorization.

Readiness conclusion: guarded startup, omission launch configuration, safe local HTTP responses and database preservation checks passed. Test-key prefix acceptance does not establish provider authentication; no external transaction has verified callback omission acceptance or resolved the historical validation error. The reported blank dashboard callback means automatic return is not expected after any future authorized checkout. A new checkout, reference, booking, provider verification or settlement remains subject to explicit separate approval. Live payments, production access and public webhooks remain disabled under the inspected guarded configuration.
