# Services

A **service** is a provisioned instance of a product owned by a customer — a
game server, a VPS, a hosting account, a domain. Services carry the billing
cycle, price and configuration chosen at order time.

## Lifecycle

```
PENDING ──payment──► ACTIVE ──overdue──► SUSPENDED ──window──► CANCELLED
                       ▲                     │
                       └──── renewal ────────┘
```

| Status | Meaning |
|---|---|
| `PENDING` | Ordered, awaiting first payment |
| `ACTIVE` | Paid and running |
| `SUSPENDED` | Overdue — access cut, data retained |
| `CANCELLED` | Terminated |
| `EXPIRED` | Reached end of a non-renewing term |

Transitions are driven by payments and the [billing cron](../billing/automation.md):

- **Activation** — on first payment, the service goes `ACTIVE`, gets an expiry
  date, and its [server](../extensions/server-modules.md) or
  [resale](../extensions/resale-modules.md) module provisions it.
- **Renewal** — paying a renewal invoice extends the expiry and, if suspended,
  unsuspends it.
- **Suspension** — the cron suspends services that are overdue by more than the
  configured grace period, calling the module's `suspend` hook.
- **Termination** — after the suspension window, the cron cancels the service
  and calls the module's `terminate`/`cancel` hook.

## Admin controls

Under **Admin → Services** you can manually **activate**, **suspend**,
**unsuspend** or **terminate** any service. Each action calls the corresponding
provisioning hook, so suspending a VPS actually powers it off.

## Customer controls

In the client area, customers see each service's details, configuration and
related invoices, and can request cancellation.

## Cancellation

Customers choose how to cancel:

- **End of term** (default) — the service keeps running until the paid period
  ends, then the cron terminates it. Open renewal invoices are voided.
- **Immediate** — the service is cancelled right away.

## Upgrades

If a product has [upgrade paths](products.md#upgrades) defined, customers see
upgrade offers on the service page. Choosing one:

1. Calculates a **prorated charge** for the difference over the remaining
   billing period.
2. Creates an upgrade invoice (or applies immediately if the charge is zero, as
   with a downgrade).
3. On payment, switches the service to the new product.

## Auto-charge

If a customer has saved a card (see [Payment gateways → stored methods](../extensions/payment-gateways.md#stored-payment-methods)),
the billing cron automatically charges their default method when a renewal
invoice comes due, retrying up to three times before leaving it for manual
payment.
