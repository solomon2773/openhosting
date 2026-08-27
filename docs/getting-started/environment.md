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
| `SEED_ADMIN_PASSWORD` | | Admin password used by `npm run db:seed`, applied only when the account is created. Defaults to `admin12345`. |
| `SEED_ADMIN_EMAIL` | | Address of the admin account the seed creates. Defaults to `admin@example.com`; the installer writes the address you chose here so re-seeding never adds a second admin. |
| `ATTACHMENT_STORAGE` | | `database` (default) or `s3` for new ticket attachments. Existing rows retain their original backend. |
| `ATTACHMENT_S3_BUCKET` | S3 only | Private bucket used for attachments. |
| `ATTACHMENT_S3_REGION` | S3 only | Bucket signing region. Defaults to `us-east-1`; R2 commonly uses `auto`. |
| `ATTACHMENT_S3_ENDPOINT` | | Custom S3-compatible endpoint. Omit for AWS S3. |
| `ATTACHMENT_S3_ACCESS_KEY_ID` | | Static access key. Set together with the secret; omit both to use the AWS credential provider chain. |
| `ATTACHMENT_S3_SECRET_ACCESS_KEY` | | Static secret key. Never expose it to the browser. |
| `ATTACHMENT_S3_FORCE_PATH_STYLE` | | `true` for providers such as a local MinIO deployment that require path-style bucket URLs. |
| `ATTACHMENT_S3_PREFIX` | | Object-key prefix. Defaults to `attachments`. |
| `ATTACHMENT_S3_DOWNLOAD_TTL_SECONDS` | | Signed download lifetime from 60 to 604800 seconds. Defaults to 300. |
| `MCP_ALLOWED_ORIGINS` | | Comma-separated extra browser origins allowed to call `/api/mcp`. Non-browser clients normally omit `Origin`. |
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
