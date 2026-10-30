# Phase 9: callback omission proposal — approval pending

The owner confirms the Paystack dashboard displays Test Mode. This is recorded as owner-reported mode evidence; it does not establish NGN eligibility, callback defaults or the rejection's exact cause. No payment behavior, launcher configuration or runtime code was changed during this review. No database connection, transaction API call, booking, payment reference, external verification, migration, public endpoint or deployment occurred. All three unresolved bookings and attempts remain untouched.

## Findings

The current adapter always sends an HTTP loopback callback constructed from the staff origin. The [Paystack callback support guide](https://support.paystack.com/en/articles/2129538) recommends HTTPS and warns against localhost callbacks. The [initialization API reference](https://paystack.com/docs/api/transaction/) marks `callback_url` optional and describes a fully qualified URL. Neither source establishes an explicit test-mode exception for our exact HTTP loopback address. Its compatibility is therefore unproven; the guidance mismatch is real, but is not the proven cause of the third `validation_error`.

The [accept-payments guide](https://paystack.com/docs/payments/accept-payments/) explicitly explains omission: the dashboard callback is used when no per-request callback is supplied. If neither is configured, the user is not redirected back after payment. Omission must mean **absence of the JSON property**, not an empty string, null, fake HTTPS URL or public tunnel.

An important prerequisite is still pending: the operator has been asked to privately inspect, without changing settings, whether the Test Mode dashboard Callback URL is blank. No URL or credentials need to be shared. Omission does not suppress an existing dashboard callback. If one is configured, review the destination privately before any future checkout; do not clear or alter it automatically or assume it is safe.

Update: the operator subsequently confirmed **the Test Mode Callback URL is blank**, without sharing a URL or credentials. The dashboard-fallback question is resolved on that owner-reported basis. If callback omission is approved and implemented, no automatic return URL is expected under the documented behavior; manual return and separately authorized verification remain necessary. This confirmation is not implementation approval, provider compatibility proof or authorization for a new transaction. No dashboard setting was changed by this work.

## Integrity and guest-flow implications

Code reviewed: `server/payments/paystack.ts`, `server/payments/service.ts`, `server/routers.ts`, and `client/src/pages/Payment.tsx`.

- Callback navigation is only a browser-return mechanism. The existing `/payment/return` effect requests verification; it never proves payment by navigation alone.
- Guest verification requires a saved submission capability and a payment reference owned by that booking. A reference alone cannot authorize it. Administrator verification remains protected by server administrator authorization.
- The server performs authoritative verification and checks provider reference, both metadata bindings, test domain, currency, exact amount, transaction identity/ownership, reservation revision/eligibility and balance consistency. Ledger credit and deduplication remain transactional. None of these checks depends on the callback URL.
- The existing payment receipt has a `Verify payment status` control. After a separately approved future test payment, the operator can return manually to `/payment` in the same audit browser and use that control. Opening `/payment` itself refreshes saved local status; it does not automatically verify a provider transaction. Such future verification is not authorized by this proposal.
- The browser must retain its booking capability. Loss of browser storage requires the existing recovery/support path, not authentication bypass or lookup by reference alone. No storage/token inspection is needed by the audit.
- With no redirect and public webhooks disabled, successful provider payment will remain locally unresolved until explicit verification. This is a reconciliation delay, not permission to infer success or pay again. This limited flow is appropriate only for the controlled local test, not a production reliability solution.
- Manual reservation confirmation remains separate from payment. No existing attempt can be reinitialized or cleared to exercise the proposed omission.

## Smallest proposed implementation

Introduce a single explicit local test switch: `SOUTHSIDE_PAYSTACK_CALLBACK_MODE=omit`.

1. In `server/payments/paystack.ts`, retain the existing callback behavior by default. In the real **test** adapter only, recognize the exact `omit` switch, omit the `callback_url` property, and skip construction of an unused callback. Reject invalid switch values before external requests. Omission remains behind the existing test-key, owned-database, fictional-booking and disabled-webhook gates. Do not change `STAFF_AUTH_ORIGIN`, staff-cookie/origin protections, endpoint, amount, metadata, references or checkout URL validation.
2. In `scripts/local/paystack-test-app.mjs`, force the exact switch for the guarded test process, alongside its existing test-only settings. Do not change dashboard configuration or introduce an external callback destination. No new secret is required.
3. Add offline tests proving the request truly lacks the property only in explicitly selected test omission mode, default behavior remains unchanged, invalid settings fail closed, and successful/failed responses, authorization and idempotent settlement checks remain intact. Keep the existing manual return/verification procedure documented; no website redesign or new verification endpoint is needed.
4. Separately extend the diagnostic exact-code allowlist from `missing_params` to include reviewed `not_found` and `rate_limited`, with source attribution and redaction tests. Retain fixed unknown labels and all existing byte/time/field limits. This improves generic coverage but is not a claimed remedy for the observed HTTP 400.

These are proposed file changes, not applied changes. An explicit switch makes the guest-flow change visible in the local launcher and preserves the current default for other callers. Even with correct omission, another validation requirement may still reject initialization. No new transaction should be bundled with implementation approval.

## Error-code review

- [Generic errors](https://paystack.com/docs/api/errors/) documents `missing_params` and the three provider error categories already allowed.
- [Virtual terminal API](https://paystack.com/docs/api/virtual-terminal/) documents `not_found` as a validation code. This is evidence of a safe provider token, not proof initialization uses it.
- [Rate limits](https://paystack.com/docs/api/rate-limits/) documents `rate_limited` with HTTP 429 and `api_error`; it does not explain the third HTTP 400.
- Current `unrecognized` loses the original code by design, so no expansion can recover it retroactively. No unrestricted code regex or raw message logging is proposed. The new allowlist may still not identify a future error.

## Verification and approval scope

This follow-up performed source/documentation review only. No new tests, build or database preservation comparison were executed; the earlier 117 passing offline tests remain earlier evidence, not a new result. The only file added is this proposal.

Request approval for **local implementation, offline mocked tests, TypeScript checks and production build only** of the guarded callback-omission switch and narrow documented-code expansion. Preserve all three attempts and financial records. Do not restart the payment server or make a provider call as part of implementation. A later restart and single controlled transaction require their own explicit approval. Before that transaction, resolve whether a dashboard callback exists; if it does, review its effect privately rather than changing it without permission.
