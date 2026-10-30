# SouthSide Hotel and Suites architecture

## Current application

The application uses React with Vite on the public side, Express and tRPC on the server side, Drizzle ORM for MySQL compatible database access, and the managed Manus server and database resources. The public preview listens on port 3000. Production uses the supplied Dockerfile and the `/api/health` endpoint.

The application runs in the Africa/Lagos operating context for hotel date boundaries. Booking dates are stored as database date values, with check in inclusive and check out exclusive overlap logic. Reservations and holds are intended to use the same category inventory. The current seed catalogue is not inserted as live inventory, and public room leads are clearly labelled as provisional.

## Main domains

`client/src` contains the route shell, public pages, booking widget, contact form, dashboard screen, and visual system. `shared/hotel.ts` contains the editable public profile, provisional room leads, facility leads, FAQs, source links, and approval checklist. `shared/booking.ts` contains deterministic date and pricing helpers.

`server/routers.ts` exposes public profile, catalogue, availability, reservation enquiry, contact submission, and protected dashboard procedures. `server/db.ts` contains database access and transaction boundaries. `server/payments/paystack.ts` contains a disabled and test ready provider boundary with initialization, verification, and raw body webhook signature checking.

`drizzle/schema.ts` contains users, room categories, room rates, inventory blocks, guests, reservations, reservation status history, booking holds, payments, contact submissions, media assets, hotel settings, and audit logs. Migration `drizzle/0001_mushy_sentry.sql` is additive and generated from the schema.

## Authentication and permissions

Staff access uses the starter Manus OAuth flow and the fixed `webdev_app_session` session contract. The dashboard uses the starter `adminProcedure`. The current starter role set includes `admin` and `user`; before live operation, the hotel should define reservation staff and finance staff permission boundaries and assign staff accounts through the authorized project owner workflow.

No administrator password is hardcoded. Unauthenticated visitors see a staff access screen and cannot fetch dashboard procedures. Private booking data is not rendered into public pages.

## Reservation lifecycle

Public date search validates future dates, check out after check in, guest counts, and room counts. Search uses server side category inventory, active reservations, active holds, and maintenance blocks. Reservation submission is intended to run in a database transaction, recheck category inventory, create a guest, create a unique non sequential reference, store rate and terms snapshots, and record the initial status history entry.

The current public booking flow intentionally stops at pending manual confirmation because the hotel has not supplied live inventory, policies, email details, or payment credentials. This prevents a redirect or browser state from being treated as a confirmed reservation.

## Paystack readiness

The code boundary expects `PAYSTACK_PUBLIC_KEY`, `PAYSTACK_SECRET_KEY`, and `PAYSTACK_WEBHOOK_SECRET` at runtime. Until all three exist, `getPaystackConfig` reports disabled and initialization throws a configuration error. Payment amounts are converted from naira to kobo on the server. Verification must be performed against Paystack, and webhook signatures must be checked against the exact raw request body. Card numbers and secrets are never stored.

Required future work is to connect the Paystack initialization route to a reservation payment state, add an idempotent webhook handler that updates the payment and reservation records, and test live and test credentials with the hotel owner. Do not describe payments as operational before that work is completed.

## Storage and media

No unapproved social images are copied into the website. The media inventory records source URLs, categories, permission state, ownership uncertainty, and the next action. When hotel supplied originals are approved, use project storage keys and persist the media record in `media_assets`. Store alt text and permission status with every asset. Do not store large images in Git.

## Environment reference

Required platform values are injected by the managed server and database resources, including `DATABASE_URL`, `MANUS_PROJECT_ID`, `MANUS_OAUTH_PORTAL_URL`, `MANUS_OAUTH_API_URL`, and `MANUS_JWT_SECRET`. Optional future values include `PAYSTACK_PUBLIC_KEY`, `PAYSTACK_SECRET_KEY`, `PAYSTACK_WEBHOOK_SECRET`, a configured business email provider, an approved analytics identifier, a confirmed public origin, and approved map configuration.

## Deployment and recovery

Run `pnpm check`, `pnpm test`, and `pnpm build` before checkpointing. Run `pnpm db:migrate` for committed additive migrations. Configure production environment values at runtime. The managed database is shared by development and publication, so do not insert fabricated guest bookings or treat development records as production data. Export or back up database data through an authorized operational process before destructive schema work. Durable media belongs in platform storage rather than the container filesystem.
