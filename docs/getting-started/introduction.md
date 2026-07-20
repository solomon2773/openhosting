# Introduction

OpenHosting is an open-source billing and client management platform for
hosting providers — the software that sits between your customers and your
infrastructure. It handles the storefront where customers order, the
recurring billing that keeps them paying, the provisioning that creates their
servers, and the support desk where they ask for help.

It is a single [Next.js](https://nextjs.org) application backed by
PostgreSQL, deployable as one container. There is no separate queue worker,
no PHP runtime, and no per-client license fee — it's MIT licensed.

## What it does

| Area | Capabilities |
|---|---|
| **Storefront** | Categories, products, six billing cycles, configurable options, cart, coupons, taxes, multi-currency |
| **Billing** | Orders → invoices → services, automated renewals, suspension and termination, account credit, auto-charge with saved cards |
| **Payments** | 19 gateways: cards, crypto, SEPA, merchant-of-record and regional |
| **Provisioning** | 27 server integrations (game panels, VPS/cloud, enterprise virt, web panels) |
| **Resale** | Domains, SSL certificates, software licenses, Microsoft 365 / Google Workspace seats |
| **Support** | Tickets with departments, priorities and attachments; notification center |
| **Accounts** | TOTP 2FA, email verification, RBAC staff roles, audit log |
| **Anti-fraud** | Order review queue, ban lists, velocity limits, risk scoring, EU VAT validation |
| **Growth** | Affiliate program, announcements, 6 themes, English & Dutch UI |
| **Platform** | REST API with scoped keys, OAuth2/SSO provider |

## How it fits together

```
                        ┌──────────────────────────────────────┐
   Customer  ─────────► │  Storefront   Client area            │
                        │  (browse,     (services, invoices,    │
                        │   cart,        tickets, account)      │
                        │   checkout)                           │
                        └──────────────┬───────────────────────┘
                                       │
                        ┌──────────────▼───────────────────────┐
   Staff    ─────────►  │  Admin panel  +  REST API / OAuth     │
                        └──────────────┬───────────────────────┘
                                       │
                        ┌──────────────▼───────────────────────┐
                        │  Billing engine                       │
                        │  (invoices, renewals, suspension)     │
                        └───┬───────────────┬──────────────┬────┘
                            │               │              │
                     ┌──────▼─────┐  ┌──────▼──────┐ ┌─────▼──────┐
                     │  Gateways  │  │   Server    │ │   Resale   │
                     │  (Stripe…) │  │  modules    │ │  modules   │
                     └────────────┘  │ (Proxmox…)  │ │ (domains…) │
                                     └─────────────┘ └────────────┘
                                       PostgreSQL
```

**Everything is a driver.** Payment gateways, server-provisioning backends and
product-resale integrations are self-contained TypeScript objects registered
in one place. The admin UI renders each driver's settings form from its own
metadata, so adding an integration never touches core code. See the
[Extensions overview](../extensions/overview.md).

**The billing engine is one idempotent cron tick.** Renewal invoicing,
off-session card charging, suspension and termination all run from a single
endpoint you call hourly — no background worker to babysit. See
[Billing automation](../billing/automation.md).

## Technology

- **Next.js 16** (App Router, Server Components, Server Actions)
- **React 19**, **Tailwind CSS 4**
- **Prisma 7** ORM on **PostgreSQL** (works with [Supabase](supabase.md))
- **Node 24**, packaged for **Docker** and **Kubernetes**

## Next steps

- Set up a local instance → [Installation](installation.md)
- Deploy for real → [Docker](docker.md) or [Kubernetes](kubernetes.md)
- Understand the moving parts → [Configuration](configuration.md)
