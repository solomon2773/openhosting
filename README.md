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
- Payment gateways as drop-in drivers: **Stripe**, **PayPal**, **Mollie**, **bank transfer** included
- Account credit balance, zero-total auto-activation, manual admin payments

**Provisioning**
- 10 server integrations included: **Pterodactyl, Proxmox VE, Convoy, VirtFusion, cPanel/WHM, DirectAdmin, Virtualizor, Plesk, Enhance, Webmin/Virtualmin**
- Automatic create / suspend / unsuspend / terminate on billing events
- Config options map to environment variables on the provisioned server

**Client area**
- Dashboard, services, invoices with online payment, account credit
- Support tickets with departments, priorities and email notifications
- Profile, password management and **TOTP two-factor auth** with QR enrolment

**Admin panel**
- Revenue dashboard, orders, invoices (mark paid / cancel), service lifecycle controls
- Product, category, coupon, tax, user and role management (RBAC permissions)
- Extension configuration UI, editable email templates, SMTP settings
- Full audit log and searchable customer list

**Platform**
- **6 built-in themes** switchable at runtime, plus a two-file recipe for custom ones
- **Multi-language UI** (English & Dutch shipped) with a storefront language picker
- REST API (`/api/v1`) with scoped API keys
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

## 🚀 Quick start (Docker)

```bash
git clone https://github.com/solomon2773/openhosting.git
cd openhosting
docker compose up -d --build
```

Then seed the admin account and demo data (from the repo, requires Node):

```bash
npm install
DATABASE_URL="postgresql://openhosting:openhosting@localhost:5432/openhosting" \
  npm run db:seed
```

Open <http://localhost:3000> — admin login `admin@example.com` / `admin12345`
(change it immediately).

### Local development

```bash
npm install
cp .env.example .env          # point DATABASE_URL at Postgres or Supabase
npm run db:push && npm run db:seed
npm run dev
```

## ☁️ Deployment

| Target | Guide |
|---|---|
| Docker / any VPS | [docs/deploy-docker.md](docs/deploy-docker.md) |
| Kubernetes (any cloud) | [docs/deploy-kubernetes.md](docs/deploy-kubernetes.md) |
| Supabase database | [docs/supabase.md](docs/supabase.md) |
| Configuration reference | [docs/configuration.md](docs/configuration.md) |
| REST API | [docs/api.md](docs/api.md) |
| Writing extensions | [docs/extensions.md](docs/extensions.md) |
| Themes | [docs/themes.md](docs/themes.md) |
| Migrating from another panel | [docs/migrations.md](docs/migrations.md) |

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

## 🤝 Contributing

PRs are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for the dev setup and
how to add a payment gateway or server integration (usually < 100 lines).

## 📄 License

[MIT](LICENSE) — free for commercial use.
