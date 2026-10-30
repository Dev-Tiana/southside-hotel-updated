# Payment, email, and backup notes

## Payment

Phase 8 implemented persistent, idempotent payment accounting, raw-body webhook validation and guest/admin receipts, verified with local simulations. The current local preview uses mock mode; external Paystack calls remain disabled. See [Phase 9 audit, private configuration and approval gates](phase-9-paystack-test-preparation.md) before attempting actual test mode.

Only separately approved test credentials and new fictional bookings may be used in this phase. Do not obtain or configure live credentials. Saved server balances and provider verification govern accounting; successful payment never automatically confirms a reservation. Invalid or stale results and reversals require review rather than automatic financial changes. Notification delivery remains disabled. The Phase 9 plan covers successful, failed, abandoned, duplicate and delayed results, signature checks and reconciliation without modifying historical bookings.

## Email

No customer email provider is configured in the current build. The contact form stores validated submissions and the public page provides a telephone and email fallback. Before launch, select an authorized business email provider, keep credentials server side, configure a verified sending domain, set the reply to address, publish privacy wording, and test contact receipt, reservation enquiry receipt, cancellation, modification, payment failure, and staff notification messages. Email delivery must not be described as active until a real inbox receives test messages.

## Backups

The managed database contains operational records and is shared by development and publication. Establish a backup owner, frequency, retention period, protected destination, and restoration runbook before live bookings. Back up guests, reservations, payments, status history, room configuration, policies, and audit records. Store approved original photography and rights evidence separately in durable object storage. Never rely on Git or a container filesystem as the only data copy.

At least once before launch, restore a protected backup into a non production environment, run migrations against the restored copy, verify reservation and payment relationships, and record the restoration result. Do not test destructive recovery against the shared production database.

## Incident response

For double booking risk, disable new online submissions, keep manual inventory controlled, inspect overlapping reservations and holds, and notify the hotel operator. For payment uncertainty, do not manually mark a reservation paid until the provider dashboard and server verification agree. For leaked credentials, revoke and rotate them immediately through the approved secret workflow. For a data access concern, preserve audit evidence and follow the project owner incident process.
