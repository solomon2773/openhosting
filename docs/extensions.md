# Writing extensions

Integrations are TypeScript driver objects — no plugin marketplace, no
runtime magic, just a file and a registry entry. The admin UI renders each
driver's `configFields` automatically.

## Payment gateway

Implement [`GatewayDriver`](../src/lib/extensions/types.ts):

```ts
// src/lib/extensions/gateways/mollie.ts
import type { GatewayDriver } from "@/lib/extensions/types";

export const mollieGateway: GatewayDriver = {
  slug: "mollie",
  name: "Mollie",
  configFields: [
    { key: "api_key", label: "API key", type: "password", required: true },
  ],
  async pay(invoice, config, urls) {
    // create a payment with the gateway's API…
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

Register it in [`registry.ts`](../src/lib/extensions/registry.ts):

```ts
export const GATEWAY_DRIVERS = [stripeGateway, paypalGateway, bankTransferGateway, mollieGateway];
```

Webhooks arrive at `/api/webhooks/<slug>` automatically.

## Server integration

Implement [`ServerDriver`](../src/lib/extensions/types.ts) with four
lifecycle hooks — `create` (return the remote resource id), `suspend`,
`unsuspend`, `terminate` — plus:

- `configFields`: global settings (panel URL, API key) shown on
  **Admin → Extensions**
- `productConfigFields`: per-product settings (plan size, location, …) shown
  on the product edit page

The billing engine calls the hooks as invoices are paid or services become
overdue; errors are captured in the audit log without blocking billing.
Customer-selected config options whose `envKey` is set are passed to
`create` as environment variables.

The included [Pterodactyl driver](../src/lib/extensions/servers/pterodactyl.ts)
is a complete ~130-line reference implementation.
