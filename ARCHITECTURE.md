# Architecture

OpenHosting is a single Next.js 16 (App Router) application backed by
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
│       ├── agent/        delegated catalog and native checkout
│       ├── acp/          versioned Agentic Commerce Protocol adapter
│       ├── mcp/          remote Streamable HTTP MCP transport
│       ├── x402/         exact USDC invoice settlement
│       ├── webhooks/     payment gateway callbacks
│       └── cron/         recurring billing tick
├── lib/
│   ├── auth.ts           sessions, password hashing, RBAC guards
│   ├── billing.ts        invoice lifecycle + renewal/suspension engine
│   ├── agent-commerce-policy.ts delegated spend/idempotency primitives
│   ├── x402.ts           protocol encoding + facilitator boundary
│   ├── cart.ts           cookie cart storage
│   ├── mail.ts           SMTP delivery + templated emails
│   ├── settings.ts       key-value settings with defaults
│   ├── totp.ts           RFC-6238 TOTP (no external dependency)
│   ├── actions/          Server Actions, one module per domain
│   ├── services/         orders, payments, provisioning services
│   └── extensions/       gateway, server, resale & AI drivers + registry
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
- **Liskov substitution.** Gateways, provisioning backends, resale providers,
  and AI providers each satisfy their own driver contract; their service
  boundary treats implementations of the same contract uniformly.
- **Interface segregation.** Payment, provisioning, resale, and AI use separate
  interfaces. Optional capabilities such as gateway webhooks/off-session
  charging, resale renewal, and constrained AI output are optional methods.
- **Dependency inversion.** High-level policy depends on abstractions:
  `billing.ts` delegates provider work to `services/provisioning.ts` and
  `services/resale.ts`, while checkout and webhooks call
  `services/payments.ts`. AI support policy lives in `services/ai.ts`; these
  service modules, rather than pages or billing policy, resolve drivers.

## Billing lifecycle

```text
checkout ──► Order + pending Services + Invoice
payment (gateway webhook / credits / admin) ──► markInvoicePaid()
    ├─ first payment: Service ACTIVE + driver.create()
    └─ renewal:       expiresAt += cycle (+ unsuspend if needed)

hourly cron (/api/cron, Bearer CRON_SECRET)
    ├─ generateRenewalInvoices()     N days before expiry (+ metered usage)
    ├─ autoChargeDueInvoices()       supported stored payment method
    ├─ cancelEndOfTermServices()     customer-scheduled cancellation
    ├─ suspendOverdueServices()      grace days after expiry  → driver.suspend()
    └─ cancelStaleSuspendedServices() after suspension window → driver.terminate()
```

## Agent commerce

```text
customer ──► expiring AgentGrant (products + currencies + spend limits)
agent ──► public catalog ──► native checkout / ACP checkout session
                    │
                    ├─ serializable spend reservation ──► Order + Invoice
                    ├─ Stripe SPT (fiat) ──► PaymentIntent ──► markInvoicePaid()
                    └─ x402 v2 (USDC) ──► verify + settle ──► markInvoicePaid()
```

`services/agent-checkout.ts` is the canonical order boundary. ACP adapts its
session lifecycle to that service; x402 adapts signed payment terms to the
normal invoice-payment lifecycle. Protocol routes do not calculate prices or
provision services themselves.

## Security notes

- Sessions are opaque IDs stored server-side with a 14-day TTL; cookies are
  `httpOnly` + `SameSite=Lax`.
- Passwords use bcrypt; API keys, agent grants, and one-time tokens are stored as SHA-256
  hashes only.
- TOTP 2FA uses a ±1 window and constant-time comparison.
- RBAC: users with a `Role` are staff; permissions are checked per admin area
  (`requireAdmin("products")` etc.). `*` grants everything.
- Every sensitive action is written to the audit log with actor + IP.
