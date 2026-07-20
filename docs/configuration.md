# Configuration

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✔ | Postgres connection (pooled URL on Supabase) |
| `DIRECT_URL` | ✔ | Direct Postgres connection for migrations |
| `CRON_SECRET` | ✔ | Bearer token protecting `POST /api/cron` |
| `SKIP_MIGRATIONS` | | `true` skips `migrate deploy` in the container entrypoint |
| `SEED_ADMIN_PASSWORD` | | Admin password used by `npm run db:seed` |
| `WHMCS_DB_URL` | | Source MySQL DSN for `npm run import:whmcs` |
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
- **Proxmox VE** — API URL + API token; per-product node, guest type
  (QEMU template clone or LXC), storage and resources. Config options with
  env keys `CORES`, `MEMORY`, `DISK` let customers pick sizes at checkout.
- **Webmin (Virtualmin)** — Webmin URL + credentials; per-product plan,
  template and feature set. Add a config option with env key `DOMAIN` so
  customers enter their domain at checkout.
- **Enterprise virt** — OpenStack & Virtuozzo (Keystone auth + Nova),
  OnApp (email + API key), VMware vCloud Director (org credentials); each
  with per-product flavor/template/network settings.

## Product resale (domains, SSL, licenses, M365)

Resale integrations fulfil non-server products. Assign one to a product
under its **Resale extension** setting; the customer enters the required
details at checkout (a domain, a CSR, a seat count) and the driver
registers/renews on payment. Configure under **Admin → Extensions**:

- **Domains** — Enom, ResellerClub, Namecheap, OpenSRS, Openprovider
- **SSL** — GoGetSSL (customer pastes a CSR + approver email)
- **Licenses** — cPanel / LiteSpeed / Softaculous / CloudLinux / Imunify360
  via your distributor's reseller API (license binds to a server IP)
- **Seats** — Microsoft 365 (Partner Center CSP) and Google Workspace
  (Reseller API)

## Billing cron

Renewals, suspensions and terminations run when `POST /api/cron` is called
with `Authorization: Bearer $CRON_SECRET`. The compose stack and the k8s
`CronJob` already do this hourly; on other platforms use any scheduler
(crontab, Vercel Cron, GitHub Actions schedule, …).
