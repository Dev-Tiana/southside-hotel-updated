# Checkout initialization: deeper offline root-cause review

> The subsequently approved [corrective stage](phase-9-corrective-stage.md) now
> implements safe stage diagnostics and string minor-unit amounts. Its tests/build
> passed without retrying initialization or changing development financial records.
> The analysis below describes the earlier adapter and its retained historical evidence.

Booking: **SSFICTIONAL09**. Existing reference: **SST-00000000000040008000000000000009**.

**A definitive historical root cause cannot be recovered from the evidence retained by the original attempt.** The strongest clue is a recorded ten-second failure interval matching the adapter's deadline. The confirmed application defect is that failure classification was discarded. An API-contract discrepancy was also identified, but there is no original HTTP response proving Paystack rejected that payload.

This follow-up used source inspection, the already-saved verification result, mocked/offline reproductions and read-only local queries. **No new Paystack API request, initialization retry, booking, attempt, reference or checkout was performed.** No financial or status record was modified. Live payments, public webhooks and production access remain excluded.

## Request and authentication reconstruction

The unchanged production adapter was invoked only with mocked `fetch`, dummy test keys and the existing reference in an offline test. The test captured:

| Property | Observed construction | Assessment |
| --- | --- | --- |
| Endpoint/method | HTTPS `api.paystack.co/transaction/initialize`, POST | Matches documented initialization endpoint. |
| Authorization | `Bearer` followed by the server test secret | Correct header construction; public key is not substituted. No actual key was loaded by the test. |
| Content type | `application/json` | Correct. |
| Amount | Numeric JSON `5000000` | Correct value in kobo for NGN 50,000.00, but the endpoint parameter table specifies a **string**. This is a serialization/contract discrepancy, not proof of provider rejection. |
| Currency/reference | `NGN` and the exact existing reference | Correct saved currency and allowed reference characters. |
| Email | `phase9-first@example.invalid` | Meets the local fictional guard. Actual provider acceptance cannot be established without the original rejection response; it must not be blamed or replaced on a guess. |
| Callback | `http://127.0.0.1:3001/payment/return` | Fully qualified, matches the configured browser origin. Provider acceptance of this exact loopback callback was not established by initialization. Do not expose the website as a workaround. |
| Metadata | JSON object containing the matching booking and attempt references | Paystack's endpoint table specifies stringified JSON, while its metadata guide illustrates an object. Canonical stringification would align the endpoint table; object use alone is not proof of a defect/rejection. |
| Other fields | No browser amount override, card details, API keys in the body, plan, split/subaccount or recurring authorization | No evidence of an unintended payment flow. |
| Transport controls | Redirects rejected; 10,000 ms AbortSignal deadline | Safe fixed-host request. The deadline does not indicate which network/body stage stalled. |

References: [Paystack transaction initialization contract](https://paystack.com/docs/api/transaction/), [authentication](https://paystack.com/docs/api/authentication/), [metadata examples](https://paystack.com/docs/payments/metadata/). These establish the expected protocol, not what the earlier unrecorded response contained.

The launcher passes the private keys in its child's environment and deletes its own temporary environment-object properties after `spawn`. A real local child-process test using a dummy key confirmed that the child retains its inherited value. That specific missing-key hypothesis was **not reproduced**. This does not prove what every historical environment value was, nor that the public/secret pair belongs to the same merchant; public-key matching is not used in this hosted server-initialized flow.

## Response parsing and checkout validation

An offline response with the documented success envelope, matching reference and `https://checkout.paystack.com/...` URL was accepted by the actual adapter. Additional tests confirmed that malformed JSON, `status=false`, missing data, a missing URL, unsafe URL variants and a mismatched reference are rejected. The current rejection behavior is deliberately strict; there is no demonstrated valid-response parser/URL bug to fix by loosening it.

The provider response first has to pass the HTTP-status, text-read, size, JSON and success-envelope checks. Only then are the hosted URL and echoed reference checked. The same generic exception hides a failure in any of those steps. The original data/HTTP status was not saved, so it is impossible to establish whether hosted URL validation was reached. No evidence justifies accepting another checkout hostname, insecure HTTP, userinfo or a different booking reference.

## Network and timing evidence

- The saved attempt moved to uncertainty after **10 recorded seconds**, matching the explicit request deadline. Database timestamp precision is seconds; this is not an exact network-duration trace.
- Offline controlled deadlines reproduced both (a) no HTTP response before the deadline and (b) successful HTTP headers followed by a stalled response body. Both become the **same generic service-unavailable exception** under the unchanged adapter. Timing therefore cannot distinguish DNS/connect/TLS/provider latency from a stalled body or a response arriving near the deadline.
- The later approved read-only verification received an actual HTTP 400 response in 1,079 ms, categorized as transaction reference not found. That proves connectivity for that later GET, not for the original POST, and does not recover the original initialization exception.
- The source contains no custom payment proxy dispatcher or TLS-validation-disable option. The guarded launcher inherits unspecified network settings from its parent. The inspected agent test shell had no configured proxy/custom-CA/Node-options flags and did not disable TLS. **That shell is not the historical private application process**, so its settings do not rule out process-specific network configuration.
- Node's proxy behavior is runtime/configuration dependent; a working browser is not evidence that a particular Node process has the same proxy/CA setup. No Windows proxy, certificate, timeout, firewall or environment setting was changed. [Official Node enterprise-network guidance](https://nodejs.org/learn/http/enterprise-network-configuration).

## Attribution by layer

| Candidate | What the evidence establishes |
| --- | --- |
| Application endpoint/authentication/amount arithmetic | Expected method, endpoint, Bearer construction, amount conversion and child key inheritance pass offline tests. No specific bug in those operations was reproduced. |
| Application serialization | Amount number versus documented string is a real contract discrepancy; metadata representations differ across provider docs. Their role in the original failure is **unproven**. |
| Application error handling | **Confirmed diagnostic defect:** distinct guard/network/HTTP/parsing/validation errors are discarded and collapsed into `initialization_uncertain`. |
| Network or deadline | Ten-second timing is consistent with a deadline failure; original error code and stage were not retained. Plausible, **not conclusively established**. |
| Paystack API rejection | Possible, but no original status/body/category exists. The later verification's HTTP 400 is a **lookup result**, not the initialization response. |
| Provider response or hosted URL validation | Possible, but no original response/validation diagnostic exists. Valid documented shapes pass offline. |

The local event labelled `provider` is written even when the call throws; its synthetic `pending` status is not a Paystack pending-status response. The existing authoritative lookup still says reference not found under the configured test integration; it does not prove initialization was never received or a checkout session never existed. The local attempt remains unresolved.

## Proposed correction — not applied to runtime code

1. Add typed, sanitized diagnostics at the adapter boundary: distinguish database guard, request deadline/network, HTTP rejection, body read, malformed/invalid envelope, missing/unsafe checkout URL and reference mismatch. Retain only operation/stage, allowlisted code, HTTP status where known, elapsed duration and whether headers were received. Never capture raw exception messages, request headers, keys, checkout/access URLs, card fields or full provider bodies.
2. Preserve the current unresolved-attempt/idempotency/accounting behavior. Do not automatically repeat POST initialization, clear active attempts, mark this booking failed, credit balances or infer success from a URL/callback. Add regression tests proving diagnostic changes cannot alter those behaviors.
3. For a later approved adapter change, canonicalize initialization amount with `cents(a.amount).toString()` and metadata with `JSON.stringify(...)`, preserving their exact values and reference bindings. This aligns the endpoint table; it is not presented as a proven fix for this historical failure.
4. Do not increase the deadline, change proxy/TLS configuration, weaken callback/checkout validation or change fictional email rules without evidence and review. Do not append diagnostic events to this existing attempt without approval for that write.

No production adapter/service, launcher, private credential helper, financial record or environment configuration was changed in this follow-up. The proposed runtime corrections remain recommendations.

## Recommended next step before another transaction

First obtain the original initialization outcome from the correct Paystack **Test-mode dashboard/provider logs**, using this exact reference and original time window. If those cannot establish it, document that limitation; do not declare it definitively failed or clear its uncertainty. Then review diagnostic-only hardening and canonical request serialization offline, with no initializer execution, before considering a separately approved controlled test. **Another fictional transaction is not being requested or initiated by this report.**

Without original provider/client trace evidence or a separately approved instrumented reproduction, a more specific root-cause claim would be speculation.

## Executed checks and preserved state

Command:

```powershell
$env:COREPACK_HOME = Join-Path (Get-Location) '.corepack'
corepack pnpm exec vitest run server/payments/initialization-audit.test.ts server/payments/paystack.test.ts server/payments/service.test.ts server/payments/testGuard.test.ts
node scripts/local/phase7-preservation.mjs --phase9
```

- **65 tests passed across 4 files**, including **8 new offline initialization-audit cases**. Fetch was mocked before adapter calls. Child-process inheritance used a dummy credential and printed only a boolean. No Paystack request or database mutation occurred in the tests.
- Read-only booking query: total NGN 50,000.00; paid NGN 0.00; outstanding NGN 50,000.00; `pending manual confirmation`; exactly one existing attempt and zero payment rows.
- Preservation comparison: **passed**, every captured historical hotel row and staff metadata fingerprint unchanged.
- The earlier read-only verification result was inspected, not rerun. No additional provider calls were made.
- Full suite/typecheck/build and write-based integration tests were not rerun for this test/documentation-only review; earlier results remain in the Stage A report.

Changed files: new `server/payments/initialization-audit.test.ts`, new `docs/phase-9-root-cause-review.md`, and a follow-up link in `docs/phase-9-initialization-investigation.md`. Ignored evidence log: `.local/phase9-root-cause-tests.log`. No application or financial schema code was modified.
