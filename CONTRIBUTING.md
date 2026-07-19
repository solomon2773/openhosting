# Contributing to OpenHosting

Thanks for helping! Issues and pull requests are welcome.

## Development setup

```bash
npm install
cp .env.example .env                       # point at a local Postgres
docker run -d --name oh-db -p 5432:5432 \
  -e POSTGRES_USER=openhosting -e POSTGRES_PASSWORD=openhosting \
  -e POSTGRES_DB=openhosting postgres:18-alpine
npm run db:push && npm run db:seed
npm run dev
```

Logins after seeding: `admin@example.com` / `admin12345` and
`demo@example.com` / `demo12345`.

## Before you open a PR

- `npm run typecheck` and `npm run build` must pass (CI enforces both).
- Follow the existing architecture (see [ARCHITECTURE.md](ARCHITECTURE.md)):
  SOLID boundaries, drivers for integrations, Server Actions per domain.
- Schema changes need a migration:
  `npx prisma migrate dev --name your_change`.
- Refresh screenshots with `npx tsx scripts/screenshots.ts` if you change UI
  that appears in the README.

## Good first contributions

- New payment gateways (Mollie, Coinbase Commerce, Razorpay, …) — see
  [docs/extensions.md](docs/extensions.md), usually < 100 lines
- New server integrations (Proxmox, VirtFusion, cPanel/WHM, Plesk, CyberPanel)
- Translations / i18n groundwork
- Tests around the billing engine
