# Affiliate program

The affiliate program lets customers earn commission for referring new
business — a standard growth lever for hosting providers.

## Enabling it

Configure under **Admin → Settings → Affiliate program**:

| Setting | Purpose |
|---|---|
| Enable affiliate program | Master switch |
| Default commission type | Percent of invoice, or fixed amount |
| Default commission value | The percent or fixed amount |
| Recurring commissions | Commission on every invoice (on) or only the first (off) |
| Payout threshold | Minimum balance before you pay an affiliate |

## How customers participate

1. A customer joins the program from **Dashboard → Affiliate**, which generates
   a unique referral code and link: `https://your-site/r/CODE`.
2. When someone clicks the link, a cookie is set (30 days, last click wins) and
   the visit is counted.
3. If that visitor signs up, they're attributed to the affiliate.
4. When the referred customer pays an invoice, the affiliate earns commission.

The affiliate dashboard shows link visits, referred signups, total earned, and
unpaid balance, plus a commission history.

## Commission rules

- **One-time vs recurring** — with recurring off, only the referred customer's
  first paid invoice earns; with it on, every paid invoice does.
- **Per-product overrides** — a product can set its own commission type and
  value (on the product edit page), overriding the program default for that
  product's share of an invoice.
- **Currency** — commissions are calculated per invoice and stored in the base
  currency.
- **Idempotent** — each invoice earns at most one commission.

## Payouts

Under **Admin → Affiliates** you see every affiliate with their visits,
signups, total earned and unpaid balance. After sending a payout (by whatever
method you use — bank transfer, PayPal, credit), click **Mark paid** to reset
their balance and record the commissions as paid.
