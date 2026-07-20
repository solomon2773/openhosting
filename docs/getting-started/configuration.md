# Configuration

OpenHosting is configured in two places: **environment variables** (set once at
deploy time) and **runtime settings** (edited in the admin panel, no restart
needed).

## Runtime settings (Admin → Settings)

Settings live in the database and take effect immediately. They're grouped into
sections:

### General

| Setting | Purpose |
|---|---|
| Company name | Shown across the site and in emails |
| Public URL | Used in emails and payment redirects — set this to your `https://` address |
| Currency | Base currency ISO code (e.g. `USD`). See [Currencies](../guides/currencies.md) |
| Theme | Brand color scheme. See [Themes](../guides/themes.md) |
| Allow new registrations | Toggle public signup |
| Require email verification | Force email confirmation after signup |

### Billing automation

| Setting | Purpose |
|---|---|
| Generate renewal invoices (days before due) | How early renewal invoices are created |
| Suspend services (days after due) | Grace period before suspension |
| Terminate services (days after suspension) | Suspension window before termination |
| Charge tax | Enable tax calculation. See [Coupons & taxes](../guides/coupons-taxes.md) |

See [Billing automation](../billing/automation.md) for how these drive the cron.

### Security

| Setting | Purpose |
|---|---|
| Turnstile site/secret key | Cloudflare Turnstile captcha keys |
| Captcha on checkout | Also require captcha at checkout, not just registration |

### Fraud

Order review, ban lists, velocity limits, risk scoring and EU VAT — documented
in full in [Fraud protection](../guides/fraud.md).

### Affiliate program

Enable/disable, default commission type and value, recurring vs one-time,
payout threshold — see [Affiliate program](../guides/affiliates.md).

### Email (SMTP)

| Setting | Purpose |
|---|---|
| From address | Sender for all outgoing mail |
| SMTP host / port | Your mail server |
| SMTP username / password | Authentication |
| Use TLS | Implicit TLS (usually port 465) |

Every message is recorded (sent or failed) in the email log. Edit the message
templates under **Admin → Email templates**.

## Extensions

Payment gateways, server modules and resale modules are configured under
**Admin → Extensions**, each with its own form. See the
[Extensions overview](../extensions/overview.md).

## Environment variables

The handful of variables set at deploy time (database URLs, the cron secret,
optional seed password) are documented in the
[Environment reference](environment.md).
