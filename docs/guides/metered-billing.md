# Usage-metered billing

For products where the price depends on consumption — bandwidth, storage, API
requests — OpenHosting can bill metered usage on top of (or instead of) a flat
recurring price.

## Making a product metered

On the product edit page, under **Usage-metered billing**:

- **Metered** — enable metering for this product
- **Unit name** — what you're measuring (e.g. `GB`, `requests`)
- **Price per unit** — the charge per unit (supports fractional cents)

## Recording usage

Push usage from your infrastructure via the REST API:

```bash
curl -X POST https://your-host/api/v1/services/<service_id>/usage \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{ "quantity": 12.5, "description": "March bandwidth (GB)" }'
```

Each call records a usage data point against the service. The API key needs the
`usage:write` scope.

## How it's billed

When the [billing cron](../billing/automation.md) generates a service's renewal
invoice, it sums all **unbilled** usage for that service, adds it as a line item
priced at the product's per-unit rate, and marks those usage records billed.
Usage therefore appears on the next renewal invoice alongside the recurring
charge.

You can check a service's current unbilled usage via
`GET /api/v1/services/<id>` (`services:read`).

## Notes

- Usage is only billed for products flagged **metered** with a unit price set.
- Recording usage against a non-metered service returns an error.
