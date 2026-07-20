# Environment reference

These variables are set at deploy time (in `.env` for local development, or the
container/pod environment in production). Runtime behavior like company name,
currency and SMTP is configured in the admin panel instead — see
[Configuration](configuration.md).

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✔ | PostgreSQL connection for the app. Use the **pooled** URL on Supabase. |
| `DIRECT_URL` | ✔ | Direct PostgreSQL connection used for migrations. On non-pooled Postgres, set it to the same value as `DATABASE_URL`. |
| `CRON_SECRET` | ✔ | Bearer token protecting `POST /api/cron`. Generate with `openssl rand -hex 32`. |
| `SKIP_MIGRATIONS` | | `true` skips `prisma migrate deploy` in the container entrypoint (when migrations run elsewhere). |
| `SEED_ADMIN_PASSWORD` | | Admin password used by `npm run db:seed`. Defaults to `admin12345`. |
| `PORT` | | Port the server listens on (default `3000`). |
| `NODE_ENV` | | Set to `production` in production (the image sets this). |
| `SHADOW_DATABASE_URL` | | Only for generating new migrations locally — a spare database Prisma uses as a shadow. |
| `WHMCS_DB_URL` | | Source MySQL DSN for `npm run import:whmcs`. See [Migrations](../migrations.md). |
| `PAYMENTER_DB_URL` | | Source MySQL DSN for `npm run import:paymenter`. See [Migrations](../migrations.md). |

## Example `.env`

```dotenv
DATABASE_URL="postgresql://openhosting:openhosting@localhost:5432/openhosting"
DIRECT_URL="postgresql://openhosting:openhosting@localhost:5432/openhosting"
CRON_SECRET="change-me-openssl-rand-hex-32"
```

## Notes

- **Secrets** (`CRON_SECRET`, database passwords) should come from your
  platform's secret store in production — a Kubernetes `Secret`, Docker secrets,
  or your PaaS's environment configuration — not committed to git.
- `.env` is git-ignored. Copy `.env.example` to start.
- Gateway and provisioning credentials are **not** environment variables —
  they're stored (encrypted at rest by your database) via the admin
  [Extensions](../extensions/overview.md) UI.
