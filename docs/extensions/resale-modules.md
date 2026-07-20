# Resale modules

Resale modules fulfil **non-server products** — domains, SSL certificates,
software licenses, and email/collaboration seats. Unlike server modules, they
collect extra input from the customer at checkout (a domain name, a CSR, a seat
count) and have a register/renew/cancel lifecycle.

Enable one under **Admin → Extensions**, attach it to a product (product edit
page → **Resale extension**), and set the per-product options. The customer's
checkout input is captured on the storefront and passed to the driver when the
invoice is paid.

## Domain registrars

Register and renew domains. The customer enters the **domain name** at checkout;
contact details are built from their profile.

| Module | Slug | Credentials |
|---|---|---|
| Enom | `enom` | Reseller login ID + API token |
| ResellerClub | `resellerclub` | Reseller ID + API key + default customer ID |
| Namecheap | `namecheap` | API user + key + whitelisted client IP |
| OpenSRS | `opensrs` | Reseller username + API key |
| Openprovider | `openprovider` | Username + password |

Per-product setting: **registration period (years)**.

## SSL certificates

### GoGetSSL (`gogetssl`)
Account email + password. Per-product GoGetSSL product ID and validity. The
customer pastes a **CSR**, **common name** and **approver email** at checkout;
the driver places the SSL order and stores its order id.

## Software licenses

### Software license (`software-license`)
A single driver covering **cPanel, LiteSpeed, Softaculous, CloudLinux and
Imunify360** via your distributor's reseller license API. Set the API endpoint
and key; choose the product and package per product. The customer enters the
**server IP** the license binds to at checkout.

## Email & collaboration seats

### Microsoft 365 (`microsoft365`)
Partner Center (CSP). Set the **partner tenant ID**, app **client ID/secret**.
Per-product offer ID. The customer enters organization name, an
`onmicrosoft` domain prefix and **seat count**; the driver creates the customer
and places the subscription order.

### Google Workspace (`google-workspace`)
Reseller API. Set the service-account **email** and **private key** and the
reseller admin email to impersonate. Per-product SKU and plan. The customer
enters their primary domain and **seat count**.

## Lifecycle

Resale modules implement `provision` (on first payment), an optional `renew`
(on renewal payment), and `cancel` (on termination). Domains typically lapse at
expiry rather than being deleted; licenses and seats are cancelled/suspended.
Failures are logged to the audit log without blocking billing.

## Adding a resale module

Implement the `ResaleDriver` interface — see
[Writing an extension](writing-extensions.md#resale-module).

> **Note:** resale drivers follow each provider's documented reseller API.
> Validate against a real reseller account in a sandbox before going live.
