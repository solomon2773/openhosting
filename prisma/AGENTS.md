# Prisma and database guidance

This file applies to `prisma/`.

## Source and generated client

- `schema.prisma` is the source of truth for the relational model.
- Prisma 7 generates into `src/generated/prisma`. Never commit or hand-edit that
  directory, and import from `@/generated/prisma/client` in application code.
- Runtime queries use the `@prisma/adapter-pg` client singleton in
  `src/lib/db.ts`. Standalone scripts create their own adapter-backed client.

## Connections

- The application uses `DATABASE_URL`, which may be pooled.
- Prisma CLI/migrations prefer `DIRECT_URL`; plain PostgreSQL can use the same
  value for both.
- Migration creation may require `SHADOW_DATABASE_URL`.
- Prisma 7 standalone TypeScript scripts do not automatically load `.env`.
  Follow the guarded `process.loadEnvFile(".env")` pattern in `seed.ts`.

## Schema and migrations

- Use `npm run db:push` only for disposable/local development databases.
- Commit a migration for every deployable schema change and inspect the SQL.
- Existing migration directories are ordered and already deployable. Never
  edit, rename, squash, or reorder a migration that may have been applied.
- Prefer additive, backward-compatible changes when app and migration rollout
  order can overlap. Plan data backfills and destructive changes explicitly.
- Regenerate the client after schema changes and run typecheck/build.

## Seed and recovery scripts

- `seed.ts` must remain idempotent. Install and upgrade flows can re-run it, so
  use upserts or existence checks and never overwrite operator-configured data.
- Keep administrator environment overrides working and never print or persist a
  generated secret unexpectedly.
- Keep the extension inventory synchronized with `src/lib/extensions/registry.ts`.
- `reset-admin.ts` is an account-recovery path used both from source and as a
  bundled container script. Preserve non-interactive `--password-stdin` support
  and safe account selection.

## Verification

For schema changes, test both a fresh database and migration of a representative
existing database when risk warrants it. At minimum run:

```bash
npm run db:generate
npm run typecheck
npm run build
```
