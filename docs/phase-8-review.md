# Phase 8 payment impact and approval review

The existing initializer trusts browser amounts/email/references, verification is not connected to accounting, and the webhook only logs events. Existing booking financial snapshots and the manual-confirmation process must remain intact.

Proposed additive migration: create `payment_attempts` and `payment_events` only. Attempts bind a server-generated reference and idempotency key to one reservation, its outstanding balance, currency, financial/stay revision and mock/test environment. Events record deduplicated status observations and review reasons. Existing `payments` is the applied-payment ledger; its unique provider reference is retained. No historical backfill or alteration of existing tables is proposed.

Financial behavior for NEW fictional Phase 8 fixtures only, if approved: an authoritative, matching successful mock verification inserts one applied payment and increases `amountPaid`/reduces `outstanding` atomically, at most once. Reservation `status`, total, rates, terms, dates and inventory commitments remain unchanged. Failed/abandoned/pending attempts never mark the reservation paid or release inventory. Suspicious, stale, wrong-amount/currency/reference/environment or over-balance success is recorded for review without automatic credit or refund. A reversal after an applied payment is flagged for review without silently rewriting historical accounting.

Only one unresolved checkout per reservation is permitted. Uncertain initialization does not silently create a replacement charge. Guest access requires the existing high-entropy booking submission capability; a booking reference or browser-supplied total is insufficient.

Approvals requested separately: (1) apply the reviewed two-table migration to both isolated local schemas; (2) create NEW clearly fictional Phase 8 bookings and test their mock accounting updates in integration and browser tests. No pre-Phase-8 booking or payment row may be changed. These approvals do NOT authorize Paystack network calls.

External calls remain disabled. A later explicit approval plus privately configured TEST keys is required. Live keys and live-mode verification results will be rejected. No live-payment implementation/activation or automatic booking confirmation is authorized.

Protocol references checked against official documentation: [transaction API](https://paystack.com/docs/api/transaction/), [verification statuses](https://paystack.com/docs/payments/verify-payments/), [webhook signature and retries](https://paystack.com/docs/payments/webhooks/). Amounts are in currency subunits; verification happens on the server. Webhook signatures use the Paystack secret key, not a separate invented signing credential.
