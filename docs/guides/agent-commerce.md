# Agent commerce

OpenHosting can let a signed-in customer delegate narrowly bounded purchases to
an autonomous client. The same checkout core powers a native JSON API, an
Agentic Commerce Protocol (ACP) adapter for Stripe delegated payments, and an
x402 v2 settlement endpoint for USDC.

Anonymous autonomous account creation is not part of this release. It remains
on the [future roadmap](../roadmap.md): an agent grant always belongs to an
existing customer account whose normal identity, fraud, and recovery controls
already apply.

## Safety model

Customers create grants under **Dashboard → Account → Agent access**. The raw
`ag_…` bearer token is displayed once; only its SHA-256 hash is stored. Each
grant has all of these boundaries:

- an expiry of at most 90 days;
- an exact product allowlist;
- an exact currency/asset allowlist;
- a maximum amount per order; and
- a cumulative committed-spend limit.

Spend limits are denominated in the installation's base currency. Reservation
uses a serializable database transaction, so simultaneous agents cannot both
consume the same remaining allowance. Creating an unpaid order commits its
amount against the grant; this is deliberately conservative and prevents an
agent from evading the cap by opening many unpaid invoices.

Revoke a grant immediately from the same page. Never put an agent token in a
URL, browser bundle, repository, log, or model prompt.

## Machine-readable catalog

`GET /api/agent/catalog` is public and returns visible products, billing-cycle
SKUs, configuration choices, metered-unit pricing, enabled currencies, asset
precision, settlement networks, and protocol endpoints. The discovery document
at `GET /.well-known/agent-commerce` points clients to that catalog.

Amounts in the catalog are advisory presentment values. Checkout always reloads
the product, stock, coupon, tax, currency rate, and grant policy and returns the
authoritative total.

## Native agent checkout

Send the grant as a bearer credential and a unique idempotency key:

```bash
curl -X POST https://billing.example.com/api/agent/checkout \
  -H 'Authorization: Bearer ag_…' \
  -H 'Idempotency-Key: deployment-2026-08-27-001' \
  -H 'Content-Type: application/json' \
  -d '{
    "currency": "USDC",
    "lines": [{
      "product_id": "PRODUCT_ID",
      "cycle": "MONTHLY",
      "quantity": 1,
      "option_value_ids": []
    }]
  }'
```

Repeating an identical request with the same key returns the original checkout.
Reusing the key with a different body is rejected. The response contains the
order, invoice, current status, and compatible payment options. Poll
`GET /api/agent/checkout/:id` with the same bearer token when needed.

## ACP 2026-04-17

The ACP adapter implements the versioned checkout-session lifecycle under
`/api/acp/checkout_sessions`:

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/acp/checkout_sessions` | Create an authoritative cart |
| `GET` | `/api/acp/checkout_sessions/:id` | Retrieve current state |
| `POST` | `/api/acp/checkout_sessions/:id` | Update items, buyer data, or discounts |
| `POST` | `/api/acp/checkout_sessions/:id/complete` | Pay and create the order |
| `POST` | `/api/acp/checkout_sessions/:id/cancel` | Cancel a draft session |

Every request needs `Authorization: Bearer ag_…` and
`API-Version: 2026-04-17`; every mutating request also needs
`Idempotency-Key`. ACP item IDs are the `sku` values from the agent catalog.
The adapter supports enabled, two-decimal ISO fiat currencies. USDC uses the
x402 path instead because ACP amounts and Stripe PaymentIntents are expressed
in fiat minor units.

Completion currently accepts the `stripe_spt` handler with a Stripe Shared
Payment Token credential. The server binds the PaymentIntent to OpenHosting's
recalculated invoice total and uses a processor idempotency key before marking
the invoice paid. Stripe describes agentic-commerce and Shared Payment Token
features as private preview, so confirm account eligibility and test-mode
behavior before enabling this surface.

## USDC and x402 v2

The seed includes USDC, disabled by default, with six-decimal precision and Base
and Solana mainnet CAIP-2 identifiers. See [Currencies](currencies.md) before
enabling it.

Enable **x402 (USDC)** under **Admin → Extensions** and configure:

- an x402 v2 facilitator base URL;
- an optional facilitator bearer credential;
- one CAIP-2 network that is also allowed on the USDC currency record;
- the official USDC contract/mint identifier for that exact network;
- the merchant receiving wallet; and
- a short authorization timeout.

For an authorized customer's pending USDC invoice, POST to
`/api/x402/invoices/:invoice_id`. With no `PAYMENT-SIGNATURE`, OpenHosting
returns `402 Payment Required` and a base64-encoded `PAYMENT-REQUIRED` header.
The client signs those exact terms and retries with `PAYMENT-SIGNATURE`.
OpenHosting binds the payload to the invoice URL, amount, asset, network, and
recipient; asks the configured facilitator to verify and settle it; persists
the network transaction before applying billing side effects; and returns the
settlement in `PAYMENT-RESPONSE`.

Settlement records make retries idempotent and prevent one proof from being
attached to multiple invoices. OpenHosting never receives or stores a payer
private key or seed phrase.

Use testnet first. Confirm the facilitator's current network support and the
official USDC identifier directly with the facilitator and Circle before moving
to mainnet. A wrong asset or receiving address can make funds unrecoverable.

## Metered services

x402 works for any pending USDC invoice, including renewal invoices containing
metered usage. Usage accumulates at eight-decimal internal precision, then
converts once to the service's locked charge asset and rounds at the invoice
boundary—six decimals for USDC and normally two for fiat.

## Protocol references

- [ACP specification](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol)
- [Stripe ACP integration](https://docs.stripe.com/agentic-commerce/protocol)
- [x402 v2 specification](https://github.com/x402-foundation/x402/blob/main/specs/x402-specification-v2.md)
- [Circle USDC documentation](https://developers.circle.com/stablecoins/usdc-contract-addresses)
