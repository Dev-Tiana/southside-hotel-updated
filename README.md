# SouthSide Hotel and Suites

React / Express / tRPC / Drizzle hotel website and management system, targeting MySQL 8+ with InnoDB. Staff login is independent email/password authentication.

## Development

Use a supported Node version with Argon2id support (verified on Node 24), and pnpm 10.18.0. Run `corepack pnpm install --frozen-lockfile`. Configure database access, staff origin and private media storage privately; `.env.example` contains names only. No credentials, accounts, database data or hotel originals are included.

Run `corepack pnpm check`, `corepack pnpm test`, and `corepack pnpm build`. To start on Windows after setting private environment values, set `NODE_ENV=production` and run `node dist/index.js`. Alternatively, review the owned-local Windows helpers under `scripts/local`; they require separately prepared private `.local` configuration.

## Safety

Payments are disabled in the configuration template. External Paystack testing and live payments are not authorized by this repository. Review all additive migrations before applying them to a separately authorized database. No migration runs during installation or build. Administrator creation requires explicit owner authorization and the private setup process; no accounts are included. Private media must be reviewed and published separately from placement.

## Media

Phase 10 public media improvements include responsive room/public galleries, keyboard-accessible full-size viewing, missing-image handling and reduced-motion support. See `docs/phase-10-public-media-implementation.md` for the exact 13 absent originals. No fictional hotel photographs are included.

## Snapshot

This is a clean source snapshot without prior Git history. Local databases, media stores, browser profiles, diagnostics and encrypted credentials are excluded. Historical fictional booking identifiers in retained test/documentation examples are anonymized; application behavior is unchanged. No production services, database migration, server restart or deployment was performed to prepare it.
