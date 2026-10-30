# Troubleshooting

## Preview does not load

Confirm the server is running on the configured port and bound to `0.0.0.0` for the managed preview. Check `GET /api/health`, inspect the dev server output, and run `pnpm check`. Do not change the runtime port without updating the managed runtime configuration.

## TypeScript or build failure

Run `pnpm check` first. Fix the first actionable source diagnostic rather than masking it with `any`. Then run `pnpm build`. If a dependency is missing, restore the lockfile and run the pinned pnpm install flow. The production build must not require private runtime credentials.

## Database is unavailable

Check that `DATABASE_URL` is present in the managed project environment and that the database capability is enabled. Run `pnpm db:migrate` only after confirming the migration is committed and additive. Do not delete or recreate the shared database to solve a local issue.

## Availability is empty

The public engine intentionally returns no live categories when the database is not configured or when active categories, rates, inventory, and policies have not been approved. In the dashboard, confirm category active state, sellable inventory, date rates, maintenance blocks, and overlapping reservations. Do not solve the issue by publishing a hardcoded availability number.

## Payment returns 503

This is the expected safe state when Paystack values or callback configuration are missing. Add the required values through the approved secret flow, restart the service if the environment requires it, and test in Paystack test mode. Never copy a secret into a browser variable or source file.

## Dashboard shows staff access only

The route is protected by the project authentication flow. Sign in through the dashboard button and confirm the account has an authorized role. Do not bypass the guard or add a password fallback. If authentication is unavailable, inspect the managed OAuth configuration and session cookie behavior in the public HTTPS preview.

## Images or source media are missing

This is intentional until permission is confirmed. Use `research/photography-inventory.csv` to request original files and rights evidence. Store approved assets in durable project storage, add alt text, and update the media record before replacing a preview frame.

## Public sitemap or canonical links look wrong

The project currently serves relative sitemap locations because the final public origin is not configured. Set the approved origin before publication, then regenerate or update absolute sitemap entries and canonical tags. Recheck robots and the sitemap from the public origin.
