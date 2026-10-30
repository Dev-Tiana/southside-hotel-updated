# Phase 9: static classifier build and controlled restart

## Completed preparation

Executed the approved local build using the existing pinned package manager:

```powershell
$env:COREPACK_HOME=Join-Path (Get-Location) '.corepack'
corepack pnpm build
```

**Build passed**, exit 0. Existing non-module platform-script and large-chunk warnings remain nonfatal. Frontend asset name remains `index-DuleuKRL.js`. The rebuilt server is 162.9 KiB as reported by esbuild.

Inspected `dist/index.js`: it contains `classifyValidationMessage`, `safeValidationMessageLabel`, bounded error-body integration, reprojected `messageLabel` and callback omission handling. No diagnostic message was generated against a real provider. The existing guarded launcher explicitly selects omission and loads this artifact.

Created a read-only audit helper, `scripts/local/phase9-classifier-restart-preservation.mjs`, using the existing exact membership/hash comparator with a separate private baseline file. Executed its syntax check and `--capture` successfully. It includes all four existing unresolved attempts and captured hotel/reservation/inventory/payment/history/audit/notification/submission records, plus staff identity/role/enabled metadata. Only hashes are saved to ignored `.local/phase9-classifier-restart-preservation.json`; no row values or credentials are printed and no SQL write is issued. The comparator must pass after restart before readiness is reported.

## Pending controlled restart

The operator has been asked to close payment/return tabs, stop the old server with Ctrl+C and wait for the private PowerShell prompt. Stop confirmation is pending. After confirming the listener is absent, the operator will run the existing encrypted credential helper's `Check` and then `Start` only after preflight passes. No execution-policy change, key exposure, new account or credential modification is needed.

Post-restart checks must confirm safe readiness, enabled test configuration, a new process started after the built artifact, loopback-only binding, disabled webhook route, callback-omission launch configuration and exact preservation comparison. Public configuration does not directly expose the classifier or omission flag; those are verified through the inspected artifact/launcher and confirmed new process, without sending a payment request or reading process secrets.

No booking, initialization, retry, provider verification, settlement, database record change, migration, production access, public endpoint or deployment occurred during preparation. The previous 164 passing offline tests remain historical; no additional suite was run merely for this rebuild/restart stage. The only new source files are the read-only audit helper and this report, plus generated build artifacts and private hash evidence. Restart and post-restart preservation results are not yet claimed.

## Follow-up: runtime unavailable, preservation passed

The operator reported stopping the old server; an independent check confirmed port 3001 was free. The operator then reported private preflight passed and the server was listening. However, subsequent independent checks could not connect to either readiness or public payment configuration, and no TCP listener was found on port 3001. Page document requests also failed to connect. Consequently successful sustained startup, active test mode and active callback-omission configuration are **not verified** at this point.

The webhook probe failed to connect rather than returning an HTTP status. A shell cast produced numeric zero from the missing response; this is **not** an HTTP status or evidence of a disabled webhook route. Runtime webhook verification remains pending. Follow-on page-root checks also encountered missing-response errors; no page success is claimed. These failed local checks did not invoke provider operations.

Reinspection still confirms the classifier and omission logic are in the built artifact, and the launcher selects test mode, omission, loopback and disabled webhooks. Artifact/launcher inspection alone is not evidence of a running process. No second server was started, and no process was terminated by the audit. The operator has been asked whether the private window is still running, returned to a prompt, or displays a startup error, without sharing secrets or full logs.

Executed `node scripts/local/phase9-classifier-restart-preservation.mjs`: **passed**. Exact pre-restart membership and hashes are unchanged across captured hotel/financial records, including all four unresolved attempts, plus staff identity/role/enabled metadata. No database write or transaction API request was made. Readiness remains blocked on clarifying the private launcher state and restoring the approved guarded listener; no checkout or further payment authorization is requested.

## Completed verification after reachability recovered

The operator confirmed the private server window was still running. Repeated read-only checks subsequently found a listener and successful readiness without another restart or any process intervention. The cause of the earlier temporary connection failure is not established; it is not being represented as a confirmed application defect.

- Exactly one listener on port 3001, bound to `127.0.0.1`, Node process 19592, parent Node process 17092. Only process IDs, parent IDs and creation times were inspected; no command line or environment was read.
- The listener process was created after the rebuilt artifact. Combined with the owner-confirmed approved-helper start and inspected artifact/launcher target, this supports loading the classifier and selecting callback mode `omit`. No provider request was made to exercise either path, and public configuration does not independently expose these internal settings.
- `/api/ready`: ready. Public payment configuration: enabled, mode test. Test-key prefix and owned-development/disabled-webhook gates remain required by the inspected launcher/configuration. Provider-side key validity remains unverified.
- POST webhook route: an actual HTTP **404**, distinguishing this successful disabled-route check from the prior connection failure.
- Homepage, accommodation catalogue, booking and staff login document requests: HTTP **200**, with the application root. These ordinary HTTP checks did not execute browser payment effects or establish an authenticated dashboard/visual walkthrough.
- Repeated `node scripts/local/phase9-classifier-restart-preservation.mjs`: **passed**. Exact captured row membership/hashes, including all four unresolved attempts and financial records, and staff identity/role/enabled metadata remain unchanged.

Final result: build, artifact inspection, owner-reported guarded restart, local readiness/test-mode/loopback/disabled-webhook checks and preservation checks passed. No new checkout, booking, retry, provider verification, financial write, deployment or public exposure occurred. Live payments and public webhooks remain disabled under the guarded configuration. The classifier is ready in the restarted build, but cannot reconstruct historical discarded messages; any future provider request needs explicit separate approval. Local website: `http://127.0.0.1:3001/`.
