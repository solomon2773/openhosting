# Coupons & taxes

## Coupons

Create coupons under **Admin → Coupons**. Each coupon has:

- **Code** — what the customer enters at checkout (e.g. `WELCOME10`)
- **Type** — percentage or fixed amount
- **Value** — the percent or fixed discount
- **Max uses** — total redemption limit (blank = unlimited)
- **Expiry** — optional date after which it stops working
- **Product restrictions** — optionally limit the coupon to specific products;
  the discount then applies only to matching cart lines

Customers apply a coupon in the cart. Percentage coupons discount the eligible
subtotal; fixed coupons subtract up to the eligible subtotal (never below zero).
Usage is counted per redemption and enforced against the max.

## Tax rates

Enable tax under **Admin → Settings → Charge tax**, then define rates under
**Admin → Tax rates**. Each rate has:

- **Name** (e.g. "VAT", "Sales tax")
- **Rate** — a percentage
- **Country** — an ISO code the rate applies to, or blank for a fallback rate
  used when no country-specific rate matches

At checkout the customer's profile country selects the rate; tax is calculated
on the discounted subtotal.

## EU VAT reverse charge

For B2B sales within the EU, OpenHosting can validate a customer's VAT ID
against the EU **VIES** service and exempt qualifying orders from tax
(reverse charge). This is configured under **Admin → Settings → Fraud** and
covered in [Fraud protection → EU VAT](fraud.md#eu-vat-reverse-charge). Domestic
sales (customer in your own country) are never reverse-charged.

## How it all combines

At checkout the order total is:

```
subtotal (line items)
  − discount (coupon, on eligible lines)
  + tax (rate × discounted subtotal, unless VAT-exempt)
= total
```

All amounts are then converted to the customer's chosen
[currency](currencies.md) and the order locks that currency for its lifetime.
