# Deployment guide

## Preflight

Run `pnpm check`, `pnpm test`, `pnpm build`, and a local health check. Confirm the route manifest, sitemap, robots, public paths, and dashboard guard. Review `docs/launch-checklist.md` and keep real reservations and payments disabled while hotel supplied details are unresolved.

## Managed publication

The project is initialized with server and database capabilities. The production container uses the repository Dockerfile, listens on the platform supplied `PORT` with 3000 as the default, and exposes `/api/health` as the unauthenticated health path. The committed build installs dependencies, compiles the Vite client and server bundle, and starts the Express service.

Before publication, set the public origin and any deployment specific environment values through the managed configuration or approved secret flow. Do not bake `DATABASE_URL`, Paystack secret values, OAuth signing material, or email credentials into a build. The application must use relative browser facing URLs and must not derive absolute URLs from an internal proxy host.

## Checkpoint

Fetch and integrate `origin/main`, commit only the intended application and documentation changes, push to `origin/main`, and verify that the platform records the pushed SHA as the checkpoint. Publication and checkpoint are separate. Do not claim a live public deployment unless the version history or publication result confirms it.

## Rollback

Use the managed version history to select a known good checkpoint and follow the platform rollback flow. Do not force push or rewrite main. Before rollback, record active reservation and payment state, verify database compatibility, and communicate the operational impact to the hotel owner. A code rollback does not automatically restore database data.

## Post deploy

Check `/api/health`, `/manus-routes.json`, `/sitemap.xml`, `/robots.txt`, the home page, accommodation, contact, booking enquiry, and staff access. Confirm that payment initialization remains disabled until the credential and end to end test gate is passed. Store approved images in durable storage rather than container local disk.
