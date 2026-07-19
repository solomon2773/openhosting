# Architecture

OpenHosting is a single Next.js 15 (App Router) application backed by
PostgreSQL through Prisma. Server Components render the UI, Server Actions
handle mutations, and route handlers expose the REST API, webhooks and the
billing cron endpoint.

## Layout

```
src/
├── app/
│   ├── (store)/          public storefront: catalog, cart, checkout
│   ├── (auth)/           login, register, 2FA, password reset
│   ├── dashboard/        client area: services, invoices, tickets, account
│   ├── admin/            staff panel: billing, catalog, customers, system
│   └── api/
│       ├── v1/           REST API (API-key auth)
│       ├── webhooks/     payment gateway callbacks
│       └── cron/         recurring billing tick
├── lib/
│   ├── auth.ts           sessions, password hashing, RBAC guards
│   ├── billing.ts        invoice lifecycle + renewal/suspension engine
│   ├── cart.ts           cookie cart storage
│   ├── mail.ts           SMTP delivery + templated emails
│   ├── settings.ts       key-value settings with defaults
│   ├── totp.ts           RFC-6238 TOTP (no external dependency)
│   ├── actions/          Server Actions, one module per domain
│   ├── services/         orders, payments, provisioning services
│   └── extensions/       gateway & server drivers + registry
└── components/           shared UI (forms, badges, ticket thread)
prisma/                   schema, migrations, seed
deploy/k8s/               Kubernetes manifests
```

## SOLID in practice

- **Single responsibility.** Each `lib` module owns one concern: `billing.ts`
  never sends HTTP requests to gateways, `mail.ts` never touches invoices,
  Server Actions are split per domain (`actions/auth.ts`, `actions/cart.ts`,
  `actions/admin.ts`, …).
- **Open/closed.** Integrations are drivers registered in
  `lib/extensions/registry.ts`. Adding Mollie or Proxmox means adding one file
  that implements the driver interface and one registry entry — no changes to
  checkout, billing or the admin UI, which all render driver config forms from
  the driver's own `configFields` metadata.
- **Liskov substitution.** Every gateway satisfies `GatewayDriver` and every
  provisioning backend satisfies `ServerDriver`; the engine treats them
  uniformly and any driver can replace any other.
- **Interface segregation.** Payment and provisioning are separate interfaces;
  optional capabilities (webhooks) are optional methods, so a simple offline
  gateway like bank transfer implements only what it needs.
- **Dependency inversion.** High-level policy depends on abstractions:
  `billing.ts` calls `services/provisioning.ts`, and checkout calls
  `services/payments.ts`. Only those two service modules resolve concrete
  drivers.

## Billing lifecycle

```
checkout ──► Order + pending Services + Invoice
payment (gateway webhook / credits / admin) ──► markInvoicePaid()
    ├─ first payment: Service ACTIVE + driver.create()
    └─ renewal:       expiresAt += cycle (+ unsuspend if needed)

hourly cron (/api/cron, Bearer CRON_SECRET)
    ├─ generateRenewalInvoices()     N days before expiry
    ├─ suspendOverdueServices()      grace days after expiry  → driver.suspend()
    └─ cancelStaleSuspendedServices() after suspension window → driver.terminate()
```

## Security notes

- Sessions are opaque IDs stored server-side with a 14-day TTL; cookies are
  `httpOnly` + `SameSite=Lax`.
- Passwords use bcrypt; API keys and one-time tokens are stored as SHA-256
  hashes only.
- TOTP 2FA uses a ±1 window and constant-time comparison.
- RBAC: users with a `Role` are staff; permissions are checked per admin area
  (`requireAdmin("products")` etc.). `*` grants everything.
- Every sensitive action is written to the audit log with actor + IP.
