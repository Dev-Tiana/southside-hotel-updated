# Phase 7 proposed local database change

Reviewed history: journal entries 0000 (users), 0001 (hotel tables), 0002 (operations and inventory), 0003 (independent staff authentication). Their SQL remains unchanged. New migration 0004 follows that sequence; no existing table or index is renamed or replaced.

`drizzle/0004_booking_reliability.sql` creates exactly two InnoDB tables:

1. `booking_submissions`: SHA256 submission identifier, SHA256 canonical request fingerprint and a unique reservation foreign key. It is written in the same transaction as a new reservation. An identical retry returns the saved reservation; a changed request using the same identifier is refused. No identifier or mapping is generated for historical reservations.
2. `booking_notifications`: two deduplicated outbox entries per newly created reservation (guest and administrator), initially disabled. It stores reservation references, delivery state and bounded failure codes, not credentials or message bodies. No historical booking notifications are backfilled or sent.

Both foreign keys use NO ACTION. The generated ALTER statements only add foreign keys to the two new tables. There are no alterations to existing tables, UPDATE, DELETE, DROP, TRUNCATE or account/role statements. Existing reservations, financial snapshots, rates, inventory, assignments, staff and media are unchanged. The existing `media_assets` table will hold new upload records; no media table change is needed.

MySQL DDL is not transactionally reversible. A guarded runner must verify the owned instance and both isolated schema names, compare all prior recorded migration hashes and detect partially created tables before applying. If tables conflict or history differs, it must stop rather than overwrite anything. Never run this against production. Approval is required before applying to `southside_development` and `southside_integration`.

Media tests may create new clearly identified local fixture files and media rows, but will not replace original paths, publish into website placements, overwrite or delete existing media. Restoring any of the thirteen original files or modifying existing placements remains a separate approved action.
