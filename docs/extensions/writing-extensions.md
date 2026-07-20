# Writing an extension

Integrations are plain TypeScript driver objects — no plugin runtime, no
marketplace format. A driver is a file plus a registry entry. The admin UI
renders its settings form from its own `configFields` metadata.

## Payment gateway

Implement [`GatewayDriver`](../../src/lib/extensions/types.ts):

```ts
// src/lib/extensions/gateways/mygateway.ts
import type { GatewayDriver } from "@/lib/extensions/types";

export const myGateway: GatewayDriver = {
  slug: "mygateway",
  name: "My Gateway",
  configFields: [
    { key: "api_key", label: "API key", type: "password", required: true },
  ],
  async pay(invoice, config, urls) {
    // create a payment with the provider's API…
    return { type: "redirect", url: checkoutUrl };
    // …or for offline methods:
    // return { type: "instructions", html: "<p>…</p>" };
  },
  async handleWebhook(request, config) {
    // verify + parse the callback, then:
    return { invoiceId, transactionId };   // marks the invoice paid
  },
};
```

Register it in [`registry.ts`](../../src/lib/extensions/registry.ts):

```ts
export const GATEWAY_DRIVERS = [ /* … */, myGateway];
```

Webhooks arrive at `/api/webhooks/<slug>` automatically. Optional methods
`createSetupRedirect` / `completeSetup` / `chargeStored` add
[stored cards & auto-charge](payment-gateways.md#stored-payment-methods).

## Server module

Implement [`ServerDriver`](../../src/lib/extensions/types.ts) with four
lifecycle hooks — `create` (return the remote resource id), `suspend`,
`unsuspend`, `terminate` — plus:

- `configFields` — global settings (panel URL, API key) shown on **Admin →
  Extensions**
- `productConfigFields` — per-product settings (plan, location, resources) shown
  on the product edit page

Customer-selected config options whose `envKey` is set are passed to `create`.
The included [Pterodactyl driver](../../src/lib/extensions/servers/pterodactyl.ts)
is a complete reference.

## Resale module

Implement [`ResaleDriver`](../../src/lib/extensions/types.ts) for non-server
products:

```ts
export const myRegistrar: ResaleDriver = {
  slug: "myregistrar",
  name: "My Registrar (domains)",
  category: "DOMAIN",              // DOMAIN | SSL | LICENSE | M365
  configFields: [ /* global credentials */ ],
  productConfigFields: [ /* per-product settings */ ],
  checkoutFields: [               // collected from the customer at checkout
    { key: "domain", label: "Domain name", type: "text", required: true },
  ],
  async provision(service, config, productConfig, resaleData) {
    // resaleData.domain holds the customer's input
    return externalReference;
  },
  async renew(service, config, productConfig) { /* optional */ },
  async cancel(service, config) { /* revoke/cancel */ },
};
```

Register it in `RESALE_DRIVERS` in `registry.ts`. The
[registrars](../../src/lib/extensions/resale) are references for each category.

## Config field types

`configFields`, `productConfigFields` and `checkoutFields` all use the same
shape:

```ts
{ key, label, type, required?, help?, options? }
```

where `type` is `"text" | "password" | "select" | "checkbox"` (resale checkout
fields also accept a `csr`/textarea rendering). `options` supplies the choices
for `select`.

## Contributing your driver

New gateways and modules are welcome as pull requests — see
[Contributing](../contributing.md). Include which provider/panel version you
tested against.
