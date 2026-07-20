# Orders & invoices

This is the heart of the system: how a cart becomes an order, an invoice, and
ultimately an active service.

## The flow

```
Cart ──checkout──► Order ──► Invoice (+ pending Services)
                     │
                     ▼
              Payment (gateway / credit / manual)
                     │
                     ▼
        Invoice PAID ──► Services ACTIVE ──► provisioning runs
```

1. **Cart.** Customers add configured products. The cart lives in a cookie, so
   no account is needed until checkout.
2. **Checkout.** On checkout OpenHosting runs a [fraud assessment](fraud.md),
   applies any [coupon](coupons-taxes.md) and [tax](coupons-taxes.md), locks the
   [currency](currencies.md), and creates the order, its invoice, and one
   pending service per line — all in a single database transaction.
3. **Payment.** The customer pays the invoice via an enabled
   [gateway](../extensions/payment-gateways.md), with [account credit](#account-credit),
   or an admin marks it paid manually.
4. **Activation.** When the invoice is paid, its services become active and
   [provisioning](../extensions/server-modules.md) runs.

Zero-total invoices (free products, 100%-off coupons) activate immediately.

## Orders

Under **Admin → Orders** you see every order with its customer, items, total
and status. An order's status is `PENDING`, `PAID`, or `CANCELLED`. If the order
was flagged for [fraud review](fraud.md), you approve or reject it here (or from
the review queue) before its services provision.

## Invoices

Under **Admin → Invoices** you can filter by status (`PENDING`, `PAID`,
`CANCELLED`, `REFUNDED`) and open any invoice to:

- **Mark paid** — record an off-platform payment (bank transfer, cash) and
  trigger activation
- **Cancel** — void a pending invoice

Customers see their own invoices in the client area, pay them online, and can
open a **print / PDF** view (browser print → Save as PDF).

## Renewal invoices

For recurring services, the [billing cron](../billing/automation.md) generates
renewal invoices a configurable number of days before the service expires,
emails the customer, and (if they've saved a card) can
[auto-charge](services.md#auto-charge) them.

## Account credit

Each customer has a credit balance (in the base currency). Admins can adjust it
on the user edit page. Customers can pay invoices with credit when their balance
covers the total; foreign-currency invoices are converted at the current rate.

## Transactions

Every successful payment is recorded as a **Payment** row against its invoice,
with the gateway, amount, and gateway-side transaction id — visible on the
invoice detail page.
