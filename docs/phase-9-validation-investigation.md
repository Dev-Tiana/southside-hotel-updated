# Phase 9: comprehensive offline validation investigation

Reviewed on 2026-10-28. **The exact rejected parameter is still not recoverable from retained evidence.** Confirmed findings are separated below from proposed diagnostics and hypotheses. No runtime behavior was changed.

## Scope and evidence

Inspected the adapter, bounded body inspector, diagnostic projection, payment service, private launcher construction, existing tests, saved sanitized results and historical reports. Public Paystack documentation was fetched; no transaction API, verification endpoint, dashboard login, database connection, credential store or browser payment flow was used. No booking, reference, financial record, configuration or migration was created/modified. All three unresolved bookings/attempts are preserved by leaving them untouched; this offline review does not claim a newly executed live database preservation check.

Third attempt evidence: HTTP 400 in 1,034 ms, body parsed, provider category `validation_error`, code `unrecognized`, validation fields empty. This establishes a provider-reported validation rejection, not its field or cause. The second attempt retained HTTP 400 but no body classification. The first initialization discarded its failure stage. Do not assume all three share a cause.

The original lookup's saved `transaction_reference_not_found` was a **local fixed category derived from exact message matching** by the separately approved read-only diagnostic tool. It was not a recovered top-level Paystack `code` and was not the third attempt's initialization error. No original initialization body/code, second initialization body/code, third raw code/message or private dashboard request/error export is retained in the inspected evidence. The owner's original Test Mode no-history finding remains owner-reported evidence only.

## Confirmed reason the code was excluded

`providerErrorBody.ts` allows exactly one code: `missing_params`. Its helper keeps exact allowlisted strings, maps null/missing values to null and maps every other non-null value to `unrecognized`. The same projection is reapplied before logging.

Thus the third diagnostic means the top-level `code` value was non-null and not exactly the allowed string. It could have been an unlisted string, different casing, or an unexpected non-string value. It does **not** reveal its spelling or prove it was a well-formed string. The unknown value was neither persisted nor included in the exception. Multiple different inputs intentionally produce identical output; this mapping cannot be inverted. Hashing or guessing likely codes now cannot recover absent evidence. No memory dumps or raw-body logging were attempted.

An empty field list means no name survived the recognized shapes and fixed field-name allowlist. It does not prove the original message lacked a useful explanation. Paystack's own generic error example identifies a missing email in a message without providing an explicit field property. Our privacy policy intentionally ignores message text.

## Documented errors and safe expansion assessment

| Item | Documentation and current handling | Assessment |
| --- | --- | --- |
| `missing_params` | [Generic errors](https://paystack.com/docs/api/errors/) shows this exact validation code; currently accepted | Known and already covered. It did not survive as the third code. |
| `not_found` | [Virtual terminal API](https://paystack.com/docs/api/virtual-terminal/) illustrates it as a validation error | An exact diagnostic-only allowlist addition can be safe. This example is a different endpoint; it does not establish that initialization returns it or that it was the third code. |
| `rate_limited` | [Rate limits](https://paystack.com/docs/api/rate-limits/) documents this exact code with `api_error` and HTTP 429 | Safe candidate for reviewed generic diagnostics, not evidence explaining the third HTTP 400/validation response. |
| `api_error`, `validation_error`, `processor_error` | Generic errors defines these categories; all already allowed | No category expansion is needed to retain these documented types. |
| Transaction/charge error descriptions | [Transaction errors](https://paystack.com/docs/api/errors/transaction/) and [charge errors](https://paystack.com/docs/api/errors/charge/) list human-readable failure conditions | Do not manufacture machine codes by converting headings to snake case. These are not a complete initialization-code registry. |
| Gateway/SDK codes | [Gateway responses](https://paystack.com/docs/payments/gateway-responses/) describes post-processing response codes; SDKs define separate client exceptions | Do not mix them into the initialization top-level `code` namespace. |

The reviewed sources do not provide a complete authoritative list of initialization validation machine codes. Exact searches did not establish proposed names such as `invalid_params` or `invalid_email` as documented initialization codes. Absence from the searched pages is not proof Paystack never emits them. No speculative codes were added.

A narrow expansion can retain reviewed exact tokens without retaining arbitrary messages. It cannot recover the third code retroactively and might not identify a future rejection. A regex that accepts any identifier-looking string would undermine the privacy boundary: email fragments, references or secrets can fit identifier alphabets. Do not use that shortcut.

Another possible reviewed improvement is **exact-match classification of documented static error descriptions**, emitting only local fixed labels such as `email_missing`, `amount_invalid`, `reference_invalid`, `merchant_disabled` or `currency_not_enabled`. Never emit the matching message or interpolate its values; use no permissive substring matching, recursive harvesting or wildcard captures. Unknown/dynamic descriptions must stay suppressed. This would be diagnostic-only and cannot drive settlement or eligibility. It is a proposal, not implemented here; an offline redaction/mismatch test set and review of its precision are needed first.

## Initialization contract review

| Component | Finding |
| --- | --- |
| Endpoint/method/headers | Fixed HTTPS transaction initialization POST with documented server-secret authentication and JSON content type. Public key is not substituted. No evidence of a dropped child-process key; dummy inheritance regression passes. Prefix checks do not establish account validity. |
| Required fields | Saved fictional email and saved balance are present. No required initialization field is demonstrably absent. Acceptance of the reserved fictional email domain is not established by public docs. Do not replace it with real guest information or weaken the fixture guard on speculation. |
| Amount | String minor units: NGN 50,000.00 becomes `"5000000"`. Correct conversion and type; no browser total is trusted. The documented NGN minimum is NGN 50, so this is not below that threshold. Merchant-specific limits remain unknown. |
| Currency | `NGN` is supported, but support is merchant/country-specific. An API key for another country's integration is not proof NGN is enabled. No account country/currency setting was privately inspected or changed. |
| Reference | Server-generated `SST-` plus hexadecimal UUID matches allowed characters. Separate booking-reference characters are metadata, not the provider reference. Existing references are preserved. |
| Callback | Current HTTP loopback callback is fully qualified and matches the local origin, but it conflicts with stronger provider support guidance recommending HTTPS and warning against localhost callbacks. This is a confirmed guidance mismatch and a credible hypothesis; it is **not proof** this test integration rejects that exact URL with HTTP 400. |
| Metadata | Initialization API table specifies stringified JSON; official metadata guide illustrates an object. The existing object preserves booking/attempt bindings. Conflicting docs prevent declaring its representation the rejection cause. No formatting change was applied. |
| Optional parameters | No plan, subscription, split, subaccount or card details are supplied. No conditional requirements for those unused paths apply. |

Sources: [Initialization contract](https://paystack.com/docs/api/transaction/), [metadata guide](https://paystack.com/docs/payments/metadata/), [supported currencies](https://paystack.com/docs/api/), [authentication](https://paystack.com/docs/api/authentication/) and [callback support guidance](https://support.paystack.com/en/articles/2129538).

The callback guidance is more restrictive than the endpoint's general fully-qualified-URL wording. Earlier reports established URL shape only; they did not establish acceptance of HTTP loopback. This new finding refines that assessment without claiming a proven cause.

## Account requirements and constraints

[Test/live mode guidance](https://support.paystack.com/en/articles/2129922) describes test mode for development without real funds. Live activation is not a proposed remedy. Test-secret ownership, account country/currency eligibility, disabled-business status, optional API IP restrictions and permitted payment channels are relevant checks to make privately without changing settings. The [authentication reference](https://paystack.com/docs/api/authentication/) documents optional IP allowlisting; the [transaction error guide](https://paystack.com/docs/api/errors/transaction/) identifies disabled-merchant rejection. Nothing retained proves one of these conditions caused this attempt.

Public webhooks and callback redirects are different mechanisms. A webhook is not required to obtain an initialization URL. Do not expose the computer or configure a public webhook to investigate this error. Callback visitation is not proof of payment, and no amount may be credited without the existing authoritative settlement checks.

## Confirmed versus hypothetical causes

- **Confirmed diagnostic information loss:** a deliberately narrow allowlist suppressed the unrecognized code. It prevented a specific diagnosis, not checkout itself. Bounded parsing succeeded and the approved redaction behaved as implemented.
- **Confirmed provider rejection class:** HTTP 400 with provider-declared validation category. No exact application payload defect is proven as its cause.
- **Hypotheses requiring provider evidence:** callback acceptance policy, metadata representation, fictional email-domain validation, currency/account eligibility or another provider validation rule. Callback now has a documented guidance concern; metadata remains ambiguous. Field-level ranking beyond that would be speculation.
- **Not supported as explanations for this attempt:** connection/header timeout, successful-body parsing failure or hosted URL rejection. The request stopped earlier at HTTP handling. Missing/invalid authentication normally maps to HTTP 401 in the documentation, but HTTP 400 is not a cryptographic proof authentication succeeded.

## Offline verification executed

Added `server/payments/providerErrorEvidence.test.ts` (10 cases). Tests prove two distinct unknown codes collapse to the same retained evidence; non-string inputs can also map to `unrecognized`; missing/null codes differ; documented candidate codes are currently excluded; and useful message-only explanations do not produce explicit validation fields. No runtime allowlist change was made.

```powershell
$env:COREPACK_HOME=Join-Path (Get-Location) '.corepack'
corepack pnpm exec vitest run server/payments/providerErrorEvidence.test.ts server/payments/providerErrorBody.test.ts server/payments/providerDiagnostics.test.ts server/payments/initialization-contract-review.test.ts server/payments/initialization-audit.test.ts server/payments/paystack.test.ts server/payments/service.test.ts server/payments/testGuard.test.ts
```

**117 tests passed in eight files**, including redaction, bounded streams, request construction, successful checkout responses, ambiguous initialization and duplicate-payment safeguards. Provider transport and database ownership are mocked. No real MySQL test, full application suite, typecheck or production build was rerun for this test/report-only review; previous stage results are not reported as new executions.

## Safest next step

1. Keep all three bookings and attempts unresolved and unchanged. Do not retry or create a fourth booking.
2. Privately inspect any existing Test Mode request/error evidence for the third attempt, or ask Paystack support for the exact validation code/field and whether HTTP loopback callbacks are accepted in this account's test flow. No support message was sent by this review. Do not send API keys, authorization headers or raw guest records.
3. Privately confirm account country/NGN eligibility and test-key ownership without changing settings or enabling live mode. A configuration mismatch, if found, should be explained before correction.
4. Review the narrow diagnostic expansion above before implementation. Risks are misclassifying provider prose and mistaking an unrelated endpoint's code for the present cause; exact matching, clear source labels and diagnostic-only use limit those risks. It provides no historical recovery guarantee. No change has been applied here.
5. If provider evidence specifically identifies the callback, discuss the smallest compatible test flow before changing behavior. Omitting an optional callback may inherit dashboard configuration and removes automatic return; changing it affects the guest flow. HTTPS or public exposure is not automatically authorized. Metadata stringification similarly remains a proposed contract alignment requiring review, not a proven fix.

No new transaction is recommended until the existing validation evidence or account/callback compatibility question is resolved. No transaction approval is requested in this report. Only this report and the new offline test file changed. Live payments, production access, public webhooks, application restarts and deployment remain excluded.
