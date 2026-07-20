# Fraud protection

Fraud is endemic in low-cost hosting — stolen cards on $3 game servers — so
OpenHosting ships a layered anti-fraud system. Everything here is configured
under **Admin → Settings → Fraud** and **Admin → Fraud protection**.

## Order review queue

The highest-value control. When an order is flagged as risky, it lands as
**PENDING_REVIEW**: its services stay pending and provisioning does **not**
run until an admin decides.

Review pending orders under **Admin → Fraud protection** (or on the order page),
where you see the risk score and notes and can **Approve** (which provisions any
already-paid services) or **Reject** (which cancels the order and voids its
invoices).

Set **"Manually review every order"** to route all orders through the queue, or
rely on the automated signals below to flag only risky ones.

## Ban lists

Under **Admin → Fraud protection** you maintain ban rules by:

- **Email** — a specific address
- **Email domain** — a whole domain
- **IP** — a client IP address
- **Country** — an ISO country code

Banned values are blocked at registration and checkout. Disposable-email domains
are blocked separately via the **"Block disposable email domains"** setting
(a built-in list of common temporary-mail providers).

## Velocity limits

Set **"Max orders per IP per hour"** to send a customer to review when they
place more orders than that from one IP within an hour (0 disables it). This
catches card-testing bursts.

## Risk scoring

OpenHosting can query external fraud services and route high-scoring orders to
review:

- **MaxMind minFraud** — set the account ID and license key
- **FraudLabs Pro** — set the API key

Orders scoring at or above the **risk score review threshold** (0–99) go to the
queue. Scoring is best-effort: a vendor outage never blocks checkout. If you use
Stripe, its Radar also screens card fraud on Stripe payments for free.

## Email verification gate

Enable **"Require verified email before ordering"** to block checkout until the
customer has confirmed their email address.

## Captcha

Cloudflare Turnstile can guard the registration form and, optionally, checkout.
Configure the site/secret keys under **Admin → Settings → Security** and toggle
**"Captcha on checkout"**. See [Accounts & security](accounts-security.md#captcha).

## EU VAT reverse charge

For EU B2B sales, enable **"EU VAT reverse charge"** and set your company
country. When a customer provides a VAT ID, OpenHosting validates it against the
EU **VIES** service (from **Account → billing**), and qualifying cross-border
orders are exempted from tax. Domestic sales are always taxed normally.

## Audit log

Every block, review decision and sensitive admin action is written to the audit
log (**Admin → Audit log**) with the actor and IP.
