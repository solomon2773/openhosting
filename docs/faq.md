# FAQ

## What is OpenHosting?

An open-source billing and client management platform for hosting providers —
storefront, recurring billing, provisioning, and support in one app. See the
[Introduction](getting-started/introduction.md).

## What does it cost?

Nothing. It's MIT licensed — free for commercial use, no per-client fees.

## What do I need to run it?

Node.js 24+ and a PostgreSQL database. That's it. It deploys as a single
container. See [Installation](getting-started/installation.md).

## Does it work with Supabase?

Yes — Supabase is just PostgreSQL. Use the pooled connection string for
`DATABASE_URL` and the direct one for `DIRECT_URL`. See
[Using Supabase](getting-started/supabase.md).

## Can I migrate from WHMCS or another panel?

Yes. There are importers for WHMCS and Paymenter that bring across customers
(with working passwords), catalog and open tickets. See
[Migrations](migrations.md).

## Which payment gateways are supported?

19, including Stripe, PayPal, Mollie, crypto (Coinbase Commerce, BTCPay, …),
SEPA (GoCardless), and regional providers (Razorpay, Paystack, Mercado Pago, …).
See [Payment gateways](extensions/payment-gateways.md).

## Which control panels can it provision?

27 integrations — game panels (Pterodactyl, Pelican, …), VPS/cloud (Proxmox,
Hetzner, DigitalOcean, …), enterprise virt (OpenStack, VMware, …) and web
panels (cPanel, Plesk, …). See [Server modules](extensions/server-modules.md).

## Can I sell domains, SSL, or Microsoft 365?

Yes — resale modules cover domain registrars, SSL certificates, software
licenses and M365/Google Workspace seats. See
[Resale modules](extensions/resale-modules.md).

## How does recurring billing work?

A single cron endpoint, called hourly, generates renewal invoices, charges saved
cards, and handles suspension/termination. See
[Billing automation](billing/automation.md).

## Do I need a background worker or message queue?

No. All recurring work runs from the one cron endpoint.

## How do I add a payment gateway or provisioning integration that isn't listed?

Write a driver — typically ~100 lines implementing a small interface — and
register it. See [Writing an extension](extensions/writing-extensions.md).

## Is there an API?

Yes — a REST API with scoped keys, plus an OAuth2 provider for SSO. See
[REST API](api/rest-api.md) and [OAuth](api/oauth.md).

## How do I change the look?

Six built-in themes switch instantly in settings; custom themes are two small
edits. See [Themes](guides/themes.md).

## What languages does the interface support?

English and Dutch out of the box, with a simple way to add more. See
[Localization](guides/i18n.md).

## How do I get help or report a bug?

Open a [discussion](https://github.com/solomon2773/openhosting/discussions) or
[issue](https://github.com/solomon2773/openhosting/issues) on GitHub.
