# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

OpenHosting is an open-source billing and client-management platform for hosting providers: a single Next.js (App Router) app backed by PostgreSQL through Prisma 7. See ARCHITECTURE.md for the full design; the essentials are below.

## Commands

```bash
npm run dev          # dev server (http://localhost:3000)
npm run typecheck    # tsc --noEmit — CI enforces this
npm run build        # production build — CI enforces this
npm run db:generate  # prisma generate (after schema changes / fresh pull)
npm run db:push      # sync schema to DB (dev only)
npm run db:migrate   # prisma migrate deploy (production)
npm run db:seed      # idempotent seed: admin account, demo catalog
npm run db:reset-admin -- --list   # staff accounts; --email/--password-stdin resets one
```

- Local DB: copy `.env.example` → `.env` (needs `DATABASE_URL` + `DIRECT_URL`); a throwaway Postgres:
  `docker run -d --name oh-db -p 5432:5432 -e POSTGRES_USER=openhosting -e POSTGRES_PASSWORD=openhosting -e POSTGRES_DB=openhosting postgres:18-alpine`
- Seed logins: `admin@example.com` / `admin12345`, `demo@example.com` / `demo12345`.
- Schema changes require a migration: `npx prisma migrate dev --name your_change` (migrations are numbered folders in `prisma/migrations/`).
- There is no test suite. CI (`.github/workflows/ci.yml`) runs `prisma generate` + `typecheck` + `build` and a Docker image build; both must pass before a PR.
- README screenshots are generated: `npx tsx scripts/screenshots.ts` (Playwright) after UI changes that appear in the README.
- Other entry points: `npm run cli` (`cli/oh.mjs`), `npm run mcp` (MCP server), `npm run import:paymenter` / `import:whmcs` (data importers).

## Critical gotchas

- **Prisma client is generated into `src/generated/prisma`** — import types and the client from `@/generated/prisma/client`, never from `@prisma/client`. All queries go through the `db` singleton in `src/lib/db.ts` (uses `@prisma/adapter-pg`).
- Prisma 7 does not auto-load `.env` in standalone scripts — `prisma/seed.ts` and the `scripts/` importers call `process.loadEnvFile(".env")` themselves; follow that pattern in new scripts.
- UI strings use the lightweight i18n in `src/lib/i18n.ts`: flat dot-path keys (`"dash.nav.services"`) in per-locale dictionaries, rendered via `t()`. Add keys there rather than hardcoding English in pages that already use `t()`.
- `prisma/seed.ts` must stay idempotent — it only creates what's missing and never overwrites operator-changed data (the installer re-runs it on every update).

## Architecture

Server Components render UI, Server Actions handle mutations, route handlers expose the REST API/webhooks/cron:

- `src/app/(store)/` public storefront · `(auth)/` login/register/2FA · `dashboard/` client area · `admin/` staff panel
- `src/app/api/v1/` REST API (API-key auth) · `api/webhooks/` gateway callbacks · `api/cron/` hourly billing tick (POST, `Authorization: Bearer $CRON_SECRET`)
- `src/lib/actions/` Server Actions, one module per domain (`auth.ts`, `cart.ts`, `admin.ts`, …)
- `src/lib/services/` orders, payments, provisioning, fraud, notifications, …
- `src/lib/extensions/` integration drivers + `registry.ts`

### Extension driver system (how integrations work)

All third-party integrations are drivers: payment gateways implement `GatewayDriver`, provisioning backends implement `ServerDriver`, resale providers implement `ResaleDriver` (all in `src/lib/extensions/types.ts`). Each driver is one file under `gateways/`, `servers/` or `resale/`, registered in `registry.ts`, with a matching `Extension` DB row (slug, enabled flag, config JSON — the seed creates disabled rows for all drivers). The admin UI renders each driver's settings form from its own `configFields` metadata, so **adding an integration = one driver file + one registry entry — no changes to checkout, billing, or admin UI**. Optional capabilities (webhooks, stored payment methods / auto-charge) are optional interface methods; simple drivers skip them.

Only `services/payments.ts` and `services/provisioning.ts` resolve concrete drivers. Higher-level code (`billing.ts`, checkout) depends on those service modules, never on drivers directly. Preserve these SOLID boundaries — they are a hard project requirement, not a suggestion.

### Billing lifecycle

```
checkout ──► Order + pending Services + Invoice
payment (webhook / credits / admin) ──► markInvoicePaid()
    ├─ first payment: Service ACTIVE + driver.create()
    └─ renewal:       expiresAt += cycle (+ unsuspend)
hourly cron ──► generateRenewalInvoices → autoChargeDueInvoices
              → suspendOverdueServices (driver.suspend)
              → cancelStaleSuspendedServices (driver.terminate)
```

`src/lib/billing.ts` owns this engine; timing knobs (`invoice_days_before`, `suspend_days_after`, `cancel_days_after`) live in the `Setting` key-value table with defaults in `src/lib/settings.ts` (`getSetting`/`setSetting`).

### Auth, RBAC, auditing

Opaque server-side sessions (14-day TTL, httpOnly cookies). Staff = users with a `Role`; admin areas are guarded per-permission via `requireAdmin("products")` etc. (`*` grants all) in `src/lib/auth.ts`. Passwords bcrypt; API keys/tokens stored as SHA-256 hashes only. Sensitive actions write to the audit log (`src/lib/audit.ts`) with actor + IP — new admin mutations should do the same.

## Deployment surfaces to keep in sync

Changes to env vars, services, or setup flow usually touch several of: `Dockerfile` / `docker-entrypoint.sh` (standalone build, runs `prisma migrate deploy` on boot unless `SKIP_MIGRATIONS=true`), `docker-compose.yml` (db + app + hourly cron curl container), `install.sh` (one-line installer *and* manager: Docker, secrets, port selection, compose stack, seed, nginx + Let's Encrypt; re-runs offer upgrade / rebuild / reset-password / reconfigure / reinstall / uninstall, each also a flag), `deploy/k8s/`, and the docs under `docs/getting-started/`. The docs in `docs/` are user-facing product documentation — update the relevant page when changing behavior they describe.
