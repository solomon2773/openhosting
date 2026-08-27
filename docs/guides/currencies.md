# Currencies

OpenHosting supports selling in multiple currencies while keeping your catalog
priced in a single **base currency**.

## Base currency

Set your base currency under **Admin → Settings → Currency** (normally an ISO
code like `USD` or `EUR`). All product prices, coupons, tax amounts and account
credit are stored in this currency.

## Additional currencies

Add more under **Admin → Currencies**. Each has:

- **Currency or asset code** (e.g. `EUR` or `USDC`)
- **Symbol** (optional, e.g. `€`)
- **Kind** — fiat or stablecoin
- **Decimals** — `2` for most fiat currencies and `6` for USDC
- **Rate** — how many units of this currency equal 1 unit of the base currency
- **Settlement networks** — CAIP-2 network identifiers accepted by the payment rail
- **Enabled** — whether customers can pick it

For example, with a `USD` base and `EUR` at rate `0.92`, a `$5.99` product shows
as `€5.51`.

## USDC

The seed data includes USDC as a disabled stablecoin with six-decimal precision.
Its initial settlement networks are Base (`eip155:8453`) and Solana mainnet
(`solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`). The `rate` is still relative to
your configured base currency; a value of `1` is only appropriate when that base
is USD and your pricing policy treats one USDC as one USD.

Enabling the asset makes it available for pricing and invoice locking. It does
not, by itself, activate on-chain collection. Configure and test the x402
gateway's facilitator, receiving address, network, and asset identifier before
accepting live payments. OpenHosting never stores a payer seed phrase or private
key.

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
