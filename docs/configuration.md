# Configuration

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✔ | Postgres connection (pooled URL on Supabase) |
| `DIRECT_URL` | ✔ | Direct Postgres connection for migrations |
| `CRON_SECRET` | ✔ | Bearer token protecting `POST /api/cron` |
| `SKIP_MIGRATIONS` | | `true` skips `migrate deploy` in the container entrypoint |
| `SEED_ADMIN_PASSWORD` | | Admin password used by `npm run db:seed` |
| `PAYMENTER_DB_URL` | | Source MySQL DSN for `npm run import:paymenter` |

## Admin → Settings

Runtime settings live in the database and are edited under **Admin →
Settings** — no redeploy needed:

- **General**: company name, public URL (used in emails + payment redirects),
  currency, registration toggle, email verification requirement.
- **Billing automation**: how many days before expiry renewal invoices are
  generated, the overdue grace period before suspension, and the suspension
  window before termination; tax on/off.
- **Email (SMTP)**: host, port, credentials, TLS and from-address. Every
  outgoing mail is recorded (sent or failed) in the email log.

## Payment gateways & server integrations

**Admin → Extensions** lists every available driver with its own config form:

- **Stripe** — secret key (+ webhook signing secret). Point a Stripe webhook
  for `checkout.session.completed` at `https://your-host/api/webhooks/stripe`.
- **PayPal** — client ID/secret, sandbox toggle. Webhook URL:
  `/api/webhooks/paypal`.
- **Bank transfer** — free-form payment instructions; admins mark invoices
  paid manually.
- **Pterodactyl** — panel URL + application API key; per-product egg, nest,
  location and resource limits are set on the product edit page.

## Billing cron

Renewals, suspensions and terminations run when `POST /api/cron` is called
with `Authorization: Bearer $CRON_SECRET`. The compose stack and the k8s
`CronJob` already do this hourly; on other platforms use any scheduler
(crontab, Vercel Cron, GitHub Actions schedule, …).
