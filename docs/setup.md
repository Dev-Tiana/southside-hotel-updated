# Setup guide

## Prerequisites

Use Node 22 or another version supported by the project, pnpm 10.18.0, and the project environment supplied by Manus. The managed project already has the required application dependencies installed.

## Install and run

From the project root run `pnpm install`, then load the managed project environment. Start the server with `pnpm dev`. The default listener is `http://127.0.0.1:3000` in the sandbox. Check `GET /api/health` and `GET /manus-routes.json` before using the preview.

Run `pnpm check` for TypeScript diagnostics, `pnpm test` for unit and platform tests, and `pnpm build` for the production bundle. The current suite includes platform authentication coverage and shared booking date and pricing coverage.

## Database

The server uses `DATABASE_URL` and Drizzle. Apply committed migrations with `pnpm db:migrate`. The current migration is `drizzle/0001_mushy_sentry.sql`. `pnpm db:push` generates a new migration and applies migrations, so use it only after reviewing the generated SQL and understanding that the managed database is shared by development and publication.

Do not seed fake guests, fake reviews, fake availability, or fake prices. The public room leads are intentionally not inserted as live inventory. Use explicit hotel supplied records for operational configuration.

## Optional payment configuration

For the current independent, isolated Windows development setup, follow [Phase 9 Paystack test preparation](phase-9-paystack-test-preparation.md). The earlier managed-platform instructions elsewhere in this document are historical.

The server requires explicit `SOUTHSIDE_PAYMENTS_MODE=test`, `PAYSTACK_TEST_NETWORK_APPROVED=1`, test-prefixed `PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY`, the owned loopback database and a configured callback origin before external test requests can run. Setting the approval gate requires the owner's separate explicit authorization. The ordinary local launcher disables payments; the mock launcher strips Paystack keys. Neither launches actual test checkout.

`PAYSTACK_WEBHOOK_SECRET` and `PAYSTACK_CALLBACK_URL` are obsolete and unused. Webhook HMAC uses the test secret key. The callback is derived from `STAFF_AUTH_ORIGIN` plus `/payment/return`. Keep secrets out of chat, source, Vite variables, terminal output and Docker contexts. Phase 9 documents private Windows credential staging without activating payment calls. Live payments remain disabled.

## Staff access

The protected dashboard uses the project authentication flow. Sign in through the dashboard entry and assign staff access through the authorized owner process. Do not add passwords to source code, `.env` files committed to Git, screenshots, or issue comments.
