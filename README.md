<div align="center">

# 🚀 OpenHosting

**Open-source billing & client management for hosting providers.**
Storefront, recurring billing, provisioning and support — one modern stack: Next.js 16 · Prisma · PostgreSQL/Supabase · Docker · Kubernetes.

[![CI](https://img.shields.io/badge/CI-GitHub_Actions-2088FF?logo=githubactions&logoColor=white)](.github/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Next.js 15](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org)
[![Prisma](https://img.shields.io/badge/Prisma-PostgreSQL-2D3748?logo=prisma)](https://www.prisma.io)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

<img src="docs/screenshots/storefront-home.png" alt="OpenHosting storefront" width="800" />

</div>

---

## Why OpenHosting?

Selling game servers, VPS or web hosting means gluing together a store, recurring
billing, provisioning and support. OpenHosting delivers that entire workflow as a
single modern TypeScript app you can deploy anywhere a container runs — a VPS,
any cloud, or a Kubernetes cluster — with Postgres or Supabase as the only
dependency. No license fees, no legacy stack.

## ✨ Features

**Store & checkout**
- Product catalog with categories, stock control and visibility rules
- Six billing cycles (one-time → biennially) with setup fees per cycle
- Configurable options (RAM, disk, …) with per-option pricing that scales with the cycle
- Cart, coupons (percent/fixed, per-product restrictions, limited uses, expiry) and country-aware tax rates
- **Multi-currency**: exchange rates, storefront currency picker, orders locked to their currency

**Billing engine**
- Orders → invoices → services, fully automated
- Automatic renewal invoicing, overdue suspension and termination (cron-driven)
- 19 payment gateways: cards (Stripe, PayPal, Mollie, Square, Authorize.net, Braintree), crypto (Coinbase Commerce, NOWPayments, BTCPay, CoinGate), SEPA (GoCardless), merchant-of-record (Lemon Squeezy), and regional (Razorpay, Mercado Pago/PIX, Paystack, Flutterwave, Midtrans, Xendit)
- Account credit balance, zero-total auto-activation, manual admin payments

**Provisioning**
- 27 server integrations: game panels (Pterodactyl, Pelican, WISP, TCAdmin2), VPS/cloud (Proxmox, SolusVM, Convoy, VirtFusion, Virtualizor, Hetzner, DigitalOcean, Vultr, Linode), enterprise virt (OpenStack, OnApp, Virtuozzo, VMware vCloud) and web panels (cPanel/WHM, DirectAdmin, Plesk, Enhance, HestiaCP, CyberPanel, CWP, InterWorx, ISPConfig, Webmin/Virtualmin)
- Automatic create / suspend / unsuspend / terminate on billing events
- Config options map to environment variables on the provisioned server

**Product resale** (beyond servers)
- Domain registrars: Enom, ResellerClub, Namecheap, OpenSRS, Openprovider (register/renew)
- SSL certificates (GoGetSSL), software licenses (cPanel/LiteSpeed/Softaculous/CloudLinux), and Microsoft 365 / Google Workspace seat resale
- Customers enter the required details (domain, CSR, seat count) at checkout

**Client area**
- Dashboard, services, invoices with online payment, account credit
- Support tickets with departments, priorities and email notifications
- Profile, password management and **TOTP two-factor auth** with QR enrolment

**Fraud prevention**
- Order review queue (hold risky orders before provisioning), ban lists (email/domain/IP/country), disposable-email blocking
- Velocity limits, MaxMind minFraud & FraudLabs Pro scoring, checkout captcha, EU VAT (VIES) reverse charge

**Affiliate program**
- Referral links, per-product or default commissions, one-time or recurring, payout threshold, affiliate & admin dashboards

**Admin panel**
- Revenue dashboard, orders, invoices (mark paid / cancel), service lifecycle controls
- Product, category, coupon, tax, user and role management (RBAC permissions)
- Extension configuration UI, editable email templates, SMTP settings
- Full audit log and searchable customer list

**Platform**
- **6 built-in themes** switchable at runtime, plus a two-file recipe for custom ones
- **Multi-language UI** (English, Dutch, French, German, Spanish) with a storefront language picker
- REST API (`/api/v1`) with scoped API keys, plus a **CLI** (`oh`) and an **MCP server** for AI assistants
- One-command importers to migrate from other billing panels
- Email notifications via SMTP with templated, per-event messages
- Docker image, docker-compose stack, Kubernetes manifests with HPA + CronJob

## 📸 Screenshots

| Storefront | Product configurator | Cart |
|---|---|---|
| ![Storefront](docs/screenshots/storefront-home.png) | ![Product](docs/screenshots/storefront-product.png) | ![Cart](docs/screenshots/storefront-cart.png) |

| Client dashboard | Invoice payment | Support ticket |
|---|---|---|
| ![Dashboard](docs/screenshots/client-dashboard.png) | ![Invoice](docs/screenshots/client-invoice-pay.png) | ![Ticket](docs/screenshots/client-ticket.png) |

| Admin dashboard | Product editor | Extensions |
|---|---|---|
| ![Admin](docs/screenshots/admin-dashboard.png) | ![Product editor](docs/screenshots/admin-product-edit.png) | ![Extensions](docs/screenshots/admin-extensions.png) |

<details>
<summary>More screenshots</summary>

| | |
|---|---|
| ![Category](docs/screenshots/storefront-category.png) | ![Login](docs/screenshots/auth-login.png) |
| ![Services](docs/screenshots/client-services.png) | ![Account](docs/screenshots/client-account.png) |
| ![Products](docs/screenshots/admin-products.png) | ![Invoices](docs/screenshots/admin-invoices.png) |
| ![Admin ticket](docs/screenshots/admin-ticket.png) | ![Settings](docs/screenshots/admin-settings.png) |

</details>

## 🚀 Quick start

One command on a fresh Linux server — it installs Docker if needed, generates
secrets, starts the stack and seeds the first admin account:

```bash
curl -fsSL https://raw.githubusercontent.com/solomon2773/openhosting/main/install.sh | bash
```

Open `http://your-server:3000` and sign in with the admin credentials the
script prints. Re-run the same command any time to update.

<details>
<summary>Manual Docker setup</summary>

```bash
git clone https://github.com/solomon2773/openhosting.git
cd openhosting
export DB_PASSWORD="$(openssl rand -hex 16)" CRON_SECRET="$(openssl rand -hex 32)"
docker compose up -d --build
docker compose exec -e SEED_ADMIN_PASSWORD="a-strong-password" app node prisma/seed.mjs
```

Open <http://localhost:3000> — admin login `admin@example.com` with the
password you chose. See the [Docker guide](docs/getting-started/docker.md).

</details>

### Local development

```bash
npm install
cp .env.example .env          # point DATABASE_URL at Postgres or Supabase
npm run db:push && npm run db:seed
npm run dev
```

## 📚 Documentation

Full documentation lives in **[docs/](docs/README.md)** — start with the
[Introduction](docs/getting-started/introduction.md). Highlights:

| | | |
|---|---|---|
| [Installation](docs/getting-started/installation.md) | [Docker](docs/getting-started/docker.md) | [Kubernetes](docs/getting-started/kubernetes.md) |
| [Configuration](docs/getting-started/configuration.md) | [Products](docs/guides/products.md) | [Billing automation](docs/billing/automation.md) |
| [Payment gateways](docs/extensions/payment-gateways.md) | [Server modules](docs/extensions/server-modules.md) | [Resale modules](docs/extensions/resale-modules.md) |
| [Fraud protection](docs/guides/fraud.md) | [Affiliates](docs/guides/affiliates.md) | [Tickets](docs/guides/tickets.md) |
| [REST API](docs/api/rest-api.md) | [OAuth / SSO](docs/api/oauth.md) | [Writing extensions](docs/extensions/writing-extensions.md) |
| [Themes](docs/guides/themes.md) | [Migrations](docs/migrations.md) | [FAQ](docs/faq.md) |
| [CLI](docs/cli.md) | [MCP server](docs/mcp.md) | [Roadmap](docs/roadmap.md) |

## 🏗 Architecture

OpenHosting is a single Next.js App Router application following SOLID
principles: payment gateways and provisioning backends are substitutable
drivers behind segregated interfaces, and the billing engine depends only on
abstractions — adding an integration never touches core code. Read the full
tour in [ARCHITECTURE.md](ARCHITECTURE.md).

```
Next.js (App Router, Server Actions)
├── Storefront  ├── Client area  ├── Admin panel  └── REST API /api/v1
src/lib
├── billing.ts            invoice lifecycle & recurring billing
├── services/             orders, payments, provisioning (SOLID service layer)
└── extensions/           GatewayDriver + ServerDriver implementations
PostgreSQL / Supabase (Prisma)
```

## 🤝 Contributing & community

PRs are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for the dev setup and
how to add a payment gateway or server integration (usually < 100 lines).
Check the [good first issues](https://github.com/solomon2773/openhosting/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)
for scoped starting points, or ask questions in
[Discussions](https://github.com/solomon2773/openhosting/discussions).

⭐ **If OpenHosting looks useful to you, a star helps other hosting
providers find it.**

## 📄 License

[MIT](LICENSE) — free for commercial use.
