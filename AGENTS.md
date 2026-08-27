# OpenHosting repository guidance

## Project summary

OpenHosting is a modular Next.js 16 App Router application for hosting billing,
customer management, support, and infrastructure provisioning. PostgreSQL is
accessed through Prisma 7. Read `README.md` for setup and repository orientation
and `ARCHITECTURE.md` for the core flow before changing cross-domain behavior.

More specific guidance exists in:

- `src/app/AGENTS.md` for pages, layouts, Server Actions, and route handlers.
- `src/lib/extensions/AGENTS.md` for third-party drivers.
- `prisma/AGENTS.md` for schema, migration, and seed work.

## Commands

```bash
npm ci
npm run db:generate
npm test
npm run test:integration
npm run typecheck
npm run build
```

Local development additionally needs PostgreSQL and normally uses:

```bash
cp .env.example .env
npm run db:push
npm run db:seed
npm run dev
```

Unit tests use Vitest. Database integration tests use a disposable PostgreSQL
Testcontainer and apply the checked-in migrations before the test files run;
they therefore require a working Docker daemon. CI requires both suites, Prisma
generation, strict type checking, a production Next.js build, and a Docker
build. Exercise third-party integrations manually against provider sandboxes.

## Architectural boundaries

- `src/app` contains Server Components and route handlers. UI mutations live in
  domain modules under `src/lib/actions`.
- `src/lib/services` owns reusable domain workflows. Keep pricing in
  `services/orders.ts`, payment integration in `services/payments.ts`, server
  integration in `services/provisioning.ts`, resale integration in
  `services/resale.ts`, and AI support policy in `services/ai.ts`.
- Keep delegated-spend and idempotency policy in `agent-commerce-policy.ts`,
  checkout orchestration in `services/agent-checkout.ts`, protocol adaptation
  in `services/acp.ts` / `x402.ts`, and processor calls in gateway drivers.
- `src/lib/billing.ts` owns invoice and recurring-service state transitions. It
  must call service abstractions instead of concrete drivers.
- Concrete third-party code belongs under `src/lib/extensions` and is registered
  in `src/lib/extensions/registry.ts`.
- All database access goes through `db` from `src/lib/db.ts`.
- Import Prisma types/client code from `@/generated/prisma/client`, never from
  `@prisma/client`; generation output is intentionally git-ignored.

## Authentication, authorization, and audit

- Use `requireUser()` for authenticated customer operations and
  `requireAdmin(permission)` for staff operations. Perform checks inside every
  mutation, even when the corresponding UI is hidden.
- REST handlers use `withApiKey(scope, handler)` and should validate write
  payloads with Zod.
- Add `audit()` calls for meaningful auth, admin, billing, account, and service
  lifecycle mutations. Never include passwords, tokens, driver credentials, or
  full payment details in audit metadata or logs.
- Webhook signature verification belongs in the gateway driver.
- Agent checkout requires a customer-owned `ag_` grant, an exact allowlist,
  bounded base-currency spend, expiry, and idempotency. Never weaken one of
  those checks in a protocol-specific route.

## UI and settings

- All app routes are deliberately dynamic; the production build must not need
  a live database.
- Existing localized UI uses `getT()` and keys from `src/lib/i18n.ts`. English
  defines the key union, so add every required locale entry with a new key.
- Theme tokens are registered in `src/lib/themes.ts` and implemented in
  `src/app/globals.css`.
- Runtime behavior belongs in the `Setting` table with a safe default in
  `src/lib/settings.ts`; deployment-only secrets and connectivity belong in
  environment variables.

## Documentation and deployment

- Update the relevant page under `docs/` when operator-visible behavior changes.
- Environment/startup changes may require synchronized edits to `.env.example`,
  `Dockerfile`, `docker-entrypoint.sh`, `docker-compose.yml`, `install.sh`, and
  `deploy/k8s`.
- Refresh README screenshots with `npx tsx scripts/screenshots.ts` when changing
  a pictured UI. The script expects a running app with seeded data.
- Preserve unrelated working-tree changes and do not edit generated artifacts.
