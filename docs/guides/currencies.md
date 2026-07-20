# Currencies

OpenHosting supports selling in multiple currencies while keeping your catalog
priced in a single **base currency**.

## Base currency

Set your base currency under **Admin → Settings → Currency** (an ISO code like
`USD` or `EUR`). All product prices, coupons, tax amounts and account credit are
stored in this currency.

## Additional currencies

Add more under **Admin → Currencies**. Each has:

- **ISO code** (e.g. `EUR`)
- **Symbol** (optional, e.g. `€`)
- **Rate** — how many units of this currency equal 1 unit of the base currency
- **Enabled** — whether customers can pick it

For example, with a `USD` base and `EUR` at rate `0.92`, a `$5.99` product shows
as `€5.51`.

## How customers use it

When more than one currency is enabled, a **currency picker** appears in the
storefront header. The choice is remembered in a cookie and stored on the
customer's profile after their first order.

## Currency locking

When a customer places an order, the **currency is locked** on the order,
invoice and services. Renewal invoices are always issued in the service's locked
currency, so a customer who ordered in EUR keeps being billed in EUR even if you
later change rates.

## Credit and conversion

Account credit is held in the base currency. When a customer pays a
foreign-currency invoice with credit, the amount is converted back to the base
currency at the current rate. Affiliate commissions are likewise stored in the
base currency.

## Keeping rates current

Rates are set manually. Update them under **Admin → Currencies** whenever you
want to reflect exchange-rate movements — existing orders keep their locked
currency and price, so changes only affect new orders.
