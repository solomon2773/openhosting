# CLI & scripts

OpenHosting is operated through npm scripts and the Prisma CLI. This page lists
what's available.

## npm scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run typecheck` | TypeScript type check (`tsc --noEmit`) |
| `npm run db:generate` | Generate the Prisma client |
| `npm run db:push` | Sync the schema to the database (development) |
| `npm run db:migrate` | Apply migrations (`prisma migrate deploy`, production) |
| `npm run db:seed` | Seed demo data |
| `npm run import:whmcs` | Import from a WHMCS database ([Migrations](migrations.md)) |
| `npm run import:paymenter` | Import from a Paymenter database ([Migrations](migrations.md)) |

## Database migrations

OpenHosting uses Prisma Migrate. In production the container applies pending
migrations on boot; to run them manually:

```bash
npm run db:migrate
```

To create a new migration after changing `prisma/schema.prisma` (development —
needs a `SHADOW_DATABASE_URL`):

```bash
SHADOW_DATABASE_URL="postgresql://…/shadow" \
  npx prisma migrate diff --from-migrations prisma/migrations \
  --to-schema prisma/schema.prisma --script > prisma/migrations/<name>/migration.sql
```

## Seeding

`npm run db:seed` is idempotent — safe to run repeatedly. It creates the admin
and demo accounts, sample catalog, and registers all extensions as disabled
rows. Override the admin password with `SEED_ADMIN_PASSWORD`.

## Capturing documentation screenshots

The repository includes a Playwright script that captures the storefront and
admin screenshots used in the README against a running, seeded instance:

```bash
BASE_URL=http://localhost:3000 npx tsx scripts/screenshots.ts
```

## Environment loading

The standalone scripts (seed, importers, screenshots) load `.env` automatically.
In CI or containers, set the variables in the environment instead. See the
[environment reference](getting-started/environment.md).
