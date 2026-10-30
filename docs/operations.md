# SouthSide operating guide

## Before accepting real reservations

An authorized hotel administrator must confirm the public business name, preferred address wording, telephone, email, room categories, sellable inventory, maximum occupancy, bed configuration, amenities, current nightly rates, date specific rates if needed, check in and check out times, cancellation and refund rules, no show rules, children and extra guest rules, deposits, payment deadlines, taxes, accepted payment methods, and confirmation rules.

The administrator must also supply approved original photographs or written licenses for each image. Public Instagram, TikTok, Google Maps, Snapchat, Facebook, and directory visibility is not enough. Each image needs a source URL, rights holder, approval contact, permitted channel, credit requirement, and approval date.

## Room catalogue workflow

Add one room category for each sellable category. Do not use physical room numbers as category names unless the hotel confirms that this is the intended public naming. Enter the room description, verified amenities, occupancy, beds, inventory quantity, active state, and rate. Keep a category disabled while any required field remains unknown.

When changing inventory, first inspect upcoming reservations. Do not reduce inventory below already allocated reservations without an explicit conflict process. Use maintenance blocks for rooms or categories that cannot be sold for a date range.

## Reservation workflow

Search uses check in and check out dates with check out treated as the departure boundary. Review the server calculated result and never rely on a guest supplied total. A website request currently enters pending manual confirmation. Staff should inspect the room category, dates, guest details, and applicable policy before moving it to confirmed.

Telephone, WhatsApp, walk in, and other manual reservations must be entered into the same reservation system and inventory model. Record the source, staff member, internal note, and any policy exception. Never maintain a separate paper or spreadsheet inventory that can diverge from online availability.

Reservation status changes should follow an approved transition path. Every meaningful change should include a timestamp and actor. A browser success page is not evidence of payment. A reservation is not confirmed merely because a guest reached a redirect page.

## Payment workflow

Payment is currently disabled. When Paystack credentials and webhook configuration are ready, enable test mode first. Confirm server side initialization, amount in kobo, NGN currency, provider reference, server side verification, signature validation, duplicate webhook handling, failed payment handling, and release of expired holds. Do not accept live payment until the hotel has tested the complete path and verified that secrets do not appear in browser code or logs.

## Contact workflow

Contact submissions are stored by the backend after validation. The success message is only shown after the backend accepts the submission. The configured hotel team should review new submissions and add an email notification provider before relying on email delivery. Telephone and email links remain available as a fallback.

## Media workflow

When the hotel supplies an image, record the original filename, source, rights holder, permission evidence, category, dimensions, alt text, and publication use. Reject or keep unpublished any asset with unresolved ownership, visible guest privacy concerns, music or creator rights issues, or unclear identity. Replace the preview cards with approved originals only after the record is updated.

## Staff access

Dashboard access is controlled by Manus OAuth and the application role. The initial administrator should be created through the authorized project owner process. Do not share accounts or place passwords in source code. Review staff roles before launch and remove access promptly when a staff member leaves.

## Backup and recovery

The managed database is shared by development and publication. Before destructive changes, export required operational records through an authorized database process and keep the export in a protected location. Keep migrations additive and repeatable. Store image originals and approved copies in durable storage. Document the last backup date, person responsible, restoration test date, and retention period.
