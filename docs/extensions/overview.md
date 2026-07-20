# Extensions overview

Integrations in OpenHosting are **drivers** — self-contained TypeScript objects
that implement a small interface and are registered in one place. There are
three kinds:

| Kind | Interface | Purpose |
|---|---|---|
| **Payment gateway** | `GatewayDriver` | Take payment for invoices |
| **Server module** | `ServerDriver` | Provision servers/accounts |
| **Resale module** | `ResaleDriver` | Register domains, issue SSL, provision seats |

## How they're configured

Every installed driver appears under **Admin → Extensions** with its own
settings form — rendered automatically from the driver's own field metadata, so
no UI code is written per integration. Enable the ones you use and fill in their
credentials.

- **Gateways** you enable appear as payment options at checkout.
- **Server** and **resale** modules are attached to products (on the product
  edit page) and provision automatically when an invoice is paid.

Credentials live in the database (via the extension's config), never in
environment variables.

## The design

The system follows a few deliberate principles:

- **Open/closed** — adding a driver is a new file plus a registry entry; core
  billing, checkout and admin code never change.
- **Metadata-driven UI** — a driver declares its config fields as data, and the
  admin renders the form.
- **Dependency inversion** — the billing engine calls service-layer functions
  (`services/payments`, `services/provisioning`, `services/resale`) that resolve
  concrete drivers; billing itself never imports a gateway or panel.
- **Interface segregation** — optional capabilities (webhooks, stored cards,
  resale renewals) are optional methods, so a simple driver implements only what
  it needs.

## Reference pages

- [Payment gateways](payment-gateways.md) — all 19, with setup
- [Server modules](server-modules.md) — all 27, with setup
- [Resale modules](resale-modules.md) — domains, SSL, licenses, seats
- [Writing an extension](writing-extensions.md) — build your own

## Webhooks

Gateways that confirm payment asynchronously receive callbacks at
`/api/webhooks/<slug>` (e.g. `/api/webhooks/stripe`). The URL is shown in each
gateway's docs below; configure it in the gateway's own dashboard.
