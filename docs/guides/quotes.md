# Quotes & estimates

Quotes let you send a customer a priced proposal they can accept online, which
then converts into an invoice — useful for custom or negotiated deals that don't
fit the self-service catalog.

## Creating a quote

Under **Admin → Quotes → New quote**:

1. Pick the **customer**.
2. Add **line items** (description, quantity, unit price).
3. Optionally set a **valid-until** date and **notes**.

The quote starts as a **draft**. Review it, then **Send to customer**, which
emails them a link and marks it **sent**.

## Customer response

The customer sees sent quotes under **Dashboard → Quotes**. They can:

- **Accept** — which generates an invoice from the quote's line items and takes
  them straight to pay it
- **Decline**

A quote past its valid-until date can no longer be accepted (it's marked
expired).

## Statuses

| Status | Meaning |
|---|---|
| Draft | Being prepared; not visible to the customer |
| Sent | Awaiting the customer's response |
| Accepted | Converted to an invoice |
| Declined | Customer declined |
| Expired | Valid-until date passed before acceptance |

## API

List and create quotes via the REST API (`quotes:read` / `quotes:write`) — see
[REST API](../api/rest-api.md).
