# Products & config options

Your catalog is organized as **categories → products → prices**, with optional
**config options** that let customers customize what they buy.

## Categories

Create categories under **Admin → Categories**. Each has a name, URL slug,
optional description, sort order, and a "hidden" flag to keep it off the
storefront. Categories group products on the store home and in the navigation.

## Products

Create and edit products under **Admin → Products**. A product has:

- **Name, slug, description** — shown on the storefront
- **Category** — where it appears
- **Stock** — leave blank for unlimited, or set a finite count (sold out hides
  the order button)
- **Hidden** — keep it off the storefront while you set it up
- **Allow quantity > 1** — let customers order multiples

## Pricing & billing cycles

Each product can offer up to six billing cycles, each with its own price and
optional setup fee:

| Cycle | Interval |
|---|---|
| One-time | No recurrence |
| Monthly | 1 month |
| Quarterly | 3 months |
| Semi-annually | 6 months |
| Annually | 12 months |
| Biennially | 24 months |

Leave a cycle's price blank to not offer it. Prices are stored in your
[base currency](currencies.md) and converted for customers who switch currency.

## Config options

Config options let customers pick variations — RAM, disk size, extra IPs — that
adjust the price. On the product edit page:

1. **Add an option** (e.g. "Memory") with an optional **env variable** name.
2. **Add values** to it (e.g. "2 GB" / `2048`, "4 GB" / `4096`), each with a
   monthly price delta.

At checkout the customer's chosen value adds its price (scaled to the billing
cycle) to the line total.

### Env variables and provisioning

The **env variable** on an option is how config values reach a
[server module](../extensions/server-modules.md). For example, a Pterodactyl
product with a "Memory" option whose env key is `SERVER_MEMORY` passes the
chosen value through to the game server's memory limit. Common keys used by the
built-in drivers include `MEMORY`, `CORES`, `DISK`, and `DOMAIN`.

## Provisioning

A product is fulfilled by one of:

- **A server module** — creates a server/account on payment. Select it under
  the product's **Server extension** setting and fill in the per-product
  settings (which egg/plan/template, resource limits). See
  [Server modules](../extensions/server-modules.md).
- **A resale module** — registers a domain, issues an SSL cert, or provisions
  seats. Select it under **Resale extension**. See
  [Resale modules](../extensions/resale-modules.md).
- **Nothing** — a manual product you fulfil yourself.

## Upgrades

Define allowed **upgrade paths** on the product edit page so customers can move
between plans with prorated billing. See [Services → Upgrades](services.md#upgrades).

## Affiliate commission override

A product can override the default affiliate commission (type and value) — see
[Affiliate program](affiliates.md).
