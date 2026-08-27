# Payment gateways

OpenHosting includes 20 payment gateways. Enable and configure the ones you use
under **Admin → Extensions**; enabled gateways appear as payment options at
checkout. Gateways that confirm payment asynchronously call back at
`/api/webhooks/<slug>` — set that URL in the gateway's dashboard.

## Cards & wallets

### Stripe (`stripe`)
Hosted Stripe Checkout. Set the **secret key** and (for confirmation) the
**webhook signing secret**; point a Stripe webhook for
`checkout.session.completed` at `/api/webhooks/stripe`. Stripe also supports
[stored cards & auto-charge](#stored-payment-methods).

### PayPal (`paypal`)
Orders API with hosted approval. Set **client ID/secret** and the sandbox
toggle. Webhook: `/api/webhooks/paypal`.

### Mollie (`mollie`)
European methods (iDEAL, Bancontact, Klarna, SEPA one-offs, cards). Set the
**API key**. Webhook: `/api/webhooks/mollie`.

### Square (`square`)
Hosted payment links. Set **access token**, **location ID**, production toggle,
and webhook signature key. Webhook: `/api/webhooks/square`.

### Authorize.net (`authorizenet`)
Hosted payment page (Accept Hosted). Set **API login ID**, **transaction key**,
signature key and sandbox toggle.

### Braintree (`braintree`)
Drop-in card UI (PayPal-owned). Set **merchant ID**, public/private keys and a
tokenization key.

## Crypto

### x402 (`x402`) — USDC machine payments

x402 v2 exact settlement for USDC invoices. Configure a facilitator URL,
CAIP-2 network, official USDC asset identifier, receiving wallet, and optional
facilitator credential. This driver is only offered for `USDC` invoices; the
other gateways are only offered for conventional three-letter currencies.
See [Agent commerce](../guides/agent-commerce.md#usdc-and-x402-v2) for the HTTP
flow and mainnet safety checklist.

### Coinbase Commerce (`coinbase-commerce`)
Hosted crypto checkout. Set the **API key** and webhook shared secret.

### NOWPayments (`nowpayments`)
Hosted crypto invoice. Set the **API key** and IPN secret.

### BTCPay Server (`btcpay`)
Self-hosted crypto. Set the **BTCPay URL**, **store ID**, **API key** and
webhook secret.

### CoinGate (`coingate`)
Hosted crypto checkout. Set the **auth token** and sandbox toggle.

## Bank / direct debit

### Bank transfer (`bank-transfer`)
Offline payments — shows your wire instructions; an admin marks the invoice paid
once funds arrive. No API.

### GoCardless (`gocardless`)
SEPA / Bacs direct debit for EU/UK recurring. Set the **access token**,
environment and webhook secret.

## Merchant of record

### Lemon Squeezy (`lemonsqueezy`)
Handles global sales tax for you. Set the **API key**, **store ID**, a
pay-what-you-want **variant ID** (for dynamic pricing) and the signing secret.

## Regional

### Razorpay (`razorpay`) — India
Payment links. Set **key ID/secret** and webhook secret.

### Mercado Pago (`mercadopago`) — LatAm / PIX
Checkout Pro. Set the **access token**.

### Paystack (`paystack`) — Africa
Hosted transaction. Set the **secret key**.

### Flutterwave (`flutterwave`) — Africa
Hosted payment link. Set the **secret key**.

### Midtrans (`midtrans`) — Indonesia / SE Asia
Snap hosted checkout. Set the **server key** and production toggle.

### Xendit (`xendit`) — SE Asia
Hosted invoice. Set the **secret API key** and webhook token.

## Stored payment methods

Gateways that support it (currently **Stripe**) let customers save a card for
automatic renewal charging. Customers add a card under **Dashboard → Billing**;
the [billing cron](../billing/automation.md) then charges their default method
when renewal invoices come due, retrying up to three times before leaving the
invoice for manual payment. See [Services → auto-charge](../guides/services.md#auto-charge).

## Adding a gateway

Any gateway is ~80–130 lines implementing the `GatewayDriver` interface. See
[Writing an extension](writing-extensions.md).
