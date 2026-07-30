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

**Public URL** deserves a word: it is the base for referral links, payment
success/cancel/webhook URLs and every link in an outgoing email. The installer
sets it for you when you give it a domain. Until it is set it holds the
`http://localhost:3000` placeholder — pages then fall back to the address the
request arrived on, so nothing user-facing shows `localhost`, but **emails
cannot use that fallback** (a mailed link must not be steerable through a
forged `Host` header), so set it on any install that sends mail.

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
| Require two-factor authentication for staff | Anyone with a role must enable 2FA before the admin panel opens, and cannot turn it off |
| Failed sign-ins before an account is locked | Password and 2FA failures counted per account (0 = off, default 5) |
| Failed sign-ins from one IP before it is locked | The same budget per client address, across all accounts (0 = off, default 20) |
| Lockout duration (minutes) | How long a lockout lasts, and the window failures are counted over (default 15) |

Both are covered in [Accounts & security](../guides/accounts-security.md#sign-in-throttling).

### AI support

| Setting | Purpose |
|---|---|
| AI reply drafts on tickets | Adds a **Draft with AI** button to the staff reply box; drafts are never sent automatically |
| Draft sign-off | Appended verbatim to drafts |
| Classify new tickets | Sets department and priority from the ticket's content when it is created |
| Minimum triage confidence | Below this the customer's own choices are kept (0-1) |

Needs an enabled AI provider extension with your own API key — see
[AI support](../guides/ai-support.md).

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
