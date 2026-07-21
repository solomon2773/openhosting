# OpenHosting Documentation

Welcome! OpenHosting is an open-source billing and client management platform
for hosting providers — storefront, recurring billing, provisioning, support
tickets and more, in a single Next.js + PostgreSQL app.

If you're new, start with the [Introduction](getting-started/introduction.md),
then follow [Installation](getting-started/installation.md).

## Getting started

- [Introduction](getting-started/introduction.md) — what OpenHosting is and how it fits together
- [Installation](getting-started/installation.md) — local development setup
- [Deploy with Docker](getting-started/docker.md) — compose stack for a single host
- [Deploy on Kubernetes](getting-started/kubernetes.md) — manifests for any cluster
- [Using Supabase](getting-started/supabase.md) — managed Postgres
- [Reverse proxy & SSL](getting-started/reverse-proxy-ssl.md) — TLS termination
- [Configuration](getting-started/configuration.md) — settings and environment variables
- [Environment reference](getting-started/environment.md) — every environment variable
- [Updating](getting-started/updating.md) — upgrading to a new version

## Guides

- [Products & config options](guides/products.md) — catalog, pricing cycles, configurable options
- [Orders & invoices](guides/orders-invoices.md) — the checkout-to-payment flow
- [Services](guides/services.md) — lifecycle, upgrades, cancellation
- [Coupons & taxes](guides/coupons-taxes.md) — discounts and tax rates
- [Currencies](guides/currencies.md) — multi-currency pricing
- [Support tickets](guides/tickets.md) — departments, priorities, attachments
- [Knowledgebase](guides/knowledgebase.md) — self-service help articles
- [Notifications](guides/notifications.md) — in-app + email, per-user preferences
- [Affiliate program](guides/affiliates.md) — referrals and commissions
- [Fraud protection](guides/fraud.md) — review queue, ban lists, risk scoring, VAT
- [Accounts & security](guides/accounts-security.md) — 2FA, roles, verification
- [Quotes & estimates](guides/quotes.md) — priced proposals customers accept online
- [Contacts & sub-accounts](guides/contacts.md) — scoped additional contacts
- [Usage-metered billing](guides/metered-billing.md) — bill by consumption
- [Mass mail](guides/mass-mail.md) — bulk email to segments
- [Announcements](guides/announcements.md) — the news/blog module
- [Themes](guides/themes.md) — built-in themes and custom ones
- [Localization (i18n)](guides/i18n.md) — languages and translations

## Extensions

- [Extensions overview](extensions/overview.md) — how the driver system works
- [Payment gateways](extensions/payment-gateways.md) — all 19 gateways and their setup
- [Server modules](extensions/server-modules.md) — all 27 provisioning integrations
- [Resale modules](extensions/resale-modules.md) — domains, SSL, licenses, M365 seats
- [Writing an extension](extensions/writing-extensions.md) — build your own driver

## Billing & API

- [Billing automation](billing/automation.md) — renewals, suspension, the cron endpoint
- [REST API](api/rest-api.md) — endpoints and API keys
- [OAuth / SSO provider](api/oauth.md) — sign users into other apps

## Operations

- [Migrating from another panel](migrations.md) — WHMCS & Paymenter importers
- [CLI](cli.md) — the `oh` command-line tool
- [MCP server](mcp.md) — AI-assistant tools for managing OpenHosting
- [FAQ](faq.md) — common questions
- [Roadmap](roadmap.md) — where OpenHosting is headed in the AI era
- [Contributing](contributing.md) — help improve OpenHosting

---

Can't find something? [Open a discussion](https://github.com/solomon2773/openhosting/discussions)
or [file an issue](https://github.com/solomon2773/openhosting/issues).
