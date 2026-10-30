# Phase 9: offline review of rejected initialization

## Conclusion

The second initialization received HTTP 400 in 1,022 ms. This establishes an HTTP rejection rather than a connection timeout, successful-body parser failure or checkout URL rejection. **The exact rejected field or account condition is not established.** No payment behavior has been changed, and no transaction API request, initialization retry, external verification, database connection/write or credential access was performed during this review. Only public documentation was fetched.

Both unresolved bookings and attempts are preserved. Tests use dummy credentials and mocked transport; they never initialize a real transaction. The saved local result is historical evidence, not a fresh database read in this offline stage.

## Evidence reviewed

- Actual adapter, payment service, guarded launcher, private credential-loader construction and existing offline tests.
- Owner-supplied initialization diagnostic: operation `initialize`, stage `http_response`, category `http_error`, 1,022 ms, headers received, status 400, no network codes.
- Saved second-test plan and read-only result: one test attempt, no checkout URL, zero ledger entries, unchanged NGN 50,000 outstanding and pending manual confirmation.
- Saved original verification: HTTP 400 `transaction_reference_not_found`, status unestablished. This was a different request and is not the second initialization's error reason.
- Owner-reported Test Mode dashboard: no transaction history for the original attempt. No dashboard error export, request trace or provider rejection code for the second attempt is available locally. No dashboard account was accessed during this review.

The original and second failures cannot be assumed to share a cause. The original discarded failure stage cannot be recovered from the second response.

## Contract comparison

The comparison follows the [transaction initialization API reference](https://paystack.com/docs/api/transaction/), [authentication reference](https://paystack.com/docs/api/authentication/), [metadata guide](https://paystack.com/docs/payments/metadata/) and [error reference](https://paystack.com/docs/api/errors/), inspected on 2026-10-28.

| Component | Actual construction | Finding |
| --- | --- | --- |
| Endpoint and method | Fixed HTTPS transaction initialization endpoint, POST | Matches API contract. No alternate proxy or test API hostname is configured in the adapter. Test/live selection uses credentials; redirects are rejected. TLS verification is not disabled. |
| Required email | Saved fictional guest email, JSON string | Present. Local fictional-address guard passes. Provider acceptance of a reserved non-deliverable domain is unknown; no evidence proves rejection for that reason. No real guest data is disclosed in this report. |
| Required amount | `cents(a.amount).toString()` | Correct string in smallest currency unit. NGN 50,000.00 becomes `"5000000"`. The old numeric-type discrepancy is corrected and is not present in the second request construction. |
| Currency | Saved attempt currency `NGN` | Correct documented string type. Service checks NGN and saved balance consistency. Whether this merchant integration supports the requested currency is not proven by local checks. |
| Reference | Existing server-generated `SST-` plus hexadecimal UUID | String, allowed characters, unique database constraint. The booking reference is metadata, not the provider reference; its characters do not violate the provider-reference rule. No new identifier was generated during this review. |
| Callback | Fully qualified HTTP loopback URL under the exact configured origin | Matches the documented fully qualified URL shape. Documentation does not establish this specific integration's acceptance of the loopback address. No evidence justifies a public tunnel or weaker callback guard. |
| Metadata | Nested JSON object with two matching binding fields | Endpoint table specifies a stringified JSON object, while the official metadata guide illustrates a nested object. This is a confirmed discrepancy against the endpoint table, **not a confirmed invalid request or proven rejection cause**, because official examples also support the object representation. |
| Authentication | Server secret passed using documented Bearer scheme; JSON content type | Correct construction. No public key is substituted into server authentication. The public key is a launcher gate, not part of this hosted initialization body. Prefix checks are not proof of key validity, matching merchant ownership or account permissions. No actual key was inspected. |
| Other parameters | No subscription plan, split/subaccount, recurring charge, card details or browser-supplied total | No missing conditional parameter is apparent for this basic hosted payment. Optional channels are omitted. |

The payment service prepares the attempt under reservation locking, checks eligibility and amountPaid + outstanding = total, and reuses active attempts. The request amount is the saved outstanding balance, not the browser summary. The launcher targets only the owned isolated development schema and excludes live keys/public webhooks. These safeguards should remain unchanged.

## Confirmed diagnostic limitation

`request()` rejects `!response.ok` before reading the HTTP body. Consequently a provider code/type or validation explanation in that body is never retained. Paystack documents structured error information, but the current record contains only the safe HTTP status and stage. This is deliberate redaction, not evidence of a parser defect. It makes several rejection causes indistinguishable.

No current evidence proves a valid response was rejected, a malformed amount was sent, a key was lost during process spawn, or Paystack created a transaction. The existing dummy-child-process test passes, showing environment inheritance is not lost merely because the parent removes a temporary property after spawn.

## Offline reproductions and limits

Added `server/payments/initialization-contract-review.test.ts` with six tests:

- capture the actual adapter request with fake keys, checking amount type/value, currency, reference alphabet, callback shape and metadata type;
- model a string-only metadata endpoint returning HTTP 400; demonstrate that a proposed JSON-string representation round-trips both binding values without changing the runtime request;
- simulate four hypothetical error origins: metadata policy, email-domain policy, callback policy and account-currency policy; all yield the same safe current HTTP diagnostic and never read a body or retry;
- accept the identical actual payload in an object-accepting mock, demonstrating why mock acceptance alone cannot establish provider acceptance.

These are simulated provider policies, not Paystack's private validator. They establish plausibility and diagnostic ambiguity, not which policy Paystack applied. Existing redaction, timeout, URL validation, amount, ownership, accounting and duplicate-prevention regressions were rerun too.

Executed from the nested project with its pinned package manager:

```powershell
$env:COREPACK_HOME=Join-Path (Get-Location) '.corepack'
corepack pnpm exec vitest run server/payments/initialization-contract-review.test.ts server/payments/initialization-audit.test.ts server/payments/paystack.test.ts server/payments/providerDiagnostics.test.ts server/payments/service.test.ts server/payments/testGuard.test.ts
corepack pnpm check
```

Results: **90 tests passed in six files; TypeScript passed.** No real MySQL suite, full suite or production build was run for this tests/documentation-only investigation. No dependencies, migration, configuration, runtime source or financial records changed.

## Hypotheses, ordered by what the evidence supports

1. **Validation/client or integration-specific rejection is the leading class.** Paystack documents HTTP 400 for validation/client errors and 401 for missing/invalid authentication. This makes request validation a stronger starting point than connection/timeout or checkout parsing, but does not prove authentication succeeded or identify a field.
2. Metadata string-versus-object is the most concrete endpoint-table discrepancy to isolate offline. Official object examples prevent treating it as a confirmed cause.
3. Provider email-domain validation, merchant-currency eligibility or loopback callback policy are plausible but unproven. Available evidence cannot honestly rank these field-level hypotheses or justify changing the fictional-only boundary, merchant settings or callback exposure.

## Safest next step and proposed changes — not applied

First obtain existing Test Mode request/error evidence for the **same second attempt**, if available privately in the dashboard or from provider support. Do not share raw bodies, guest information, keys or headers in chat. A safe provider error code/category or private confirmation of the rejected field would distinguish hypotheses without another transaction. No support message has been sent by this review.

If existing evidence cannot be obtained, propose a separate diagnostic-only change for review: bounded, deadline-aware reading of non-2xx JSON with strict allowlisted code/type mapping. Never log arbitrary provider `message`, body, `meta`, guest details, URLs or headers. Keep settlement/idempotency behavior unchanged and test malicious/malformed/oversized bodies and redaction offline. This would help only a future separately approved request; it cannot recover the discarded historical body.

Canonicalizing request metadata to `JSON.stringify(...)` would align with the endpoint table and preserve both binding values, but is a payment-request behavior change. **It has not been applied and should not be represented as a confirmed fix.** Any such change needs review before another transaction. Do not change amounts, references, emails, callback exposure or keys on speculation. Do not retry either unresolved initialization. Any future provider verification or checkout remains subject to separate approval.

Only the new test file and this report were changed during this investigation. Live payments, production access and public webhooks remain disabled by the existing guarded configuration; no runtime configuration was changed or newly activated here.
