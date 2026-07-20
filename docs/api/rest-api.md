# REST API

OpenHosting exposes a versioned REST API for integrations and automation.

**Base URL:** `https://your-host/api/v1`

## Authentication

Create an API key under **Admin → API keys** (the raw key is shown once) and
send it as a Bearer token:

```bash
curl -H "Authorization: Bearer oh_xxxxxxxx…" https://your-host/api/v1/products
```

Keys carry **scoped permissions** (`users:read`, `tickets:write`, …). A key with
no scopes selected has full access (`*`). Each key records its last-used time.

## Endpoints

| Method | Path | Scope | Description |
|---|---|---|---|
| GET | `/api/v1/users` | `users:read` | List users (paginated) |
| GET | `/api/v1/users/:id` | `users:read` | A user with services + counts |
| GET | `/api/v1/products` | `products:read` | Catalog with all prices |
| POST | `/api/v1/users` | `users:write` | Create a customer |
| GET | `/api/v1/services` | `services:read` | List services (filter `?status=`, `?user_id=`) |
| GET | `/api/v1/services/:id` | `services:read` | A service + unbilled usage |
| POST | `/api/v1/services/:id` | `services:write` | Suspend / unsuspend / terminate |
| POST | `/api/v1/services/:id/usage` | `usage:write` | Push a metered usage record |
| GET | `/api/v1/categories` | `products:read` | Product categories |
| GET | `/api/v1/orders` | `orders:read` | Orders with line items |
| GET | `/api/v1/invoices` | `invoices:read` | Invoices (filter `?status=`) |
| GET | `/api/v1/invoices/:id` | `invoices:read` | An invoice + items + payments |
| POST | `/api/v1/invoices/:id` | `invoices:write` | Mark an invoice paid |
| GET | `/api/v1/coupons` | `coupons:read` | List coupons |
| POST | `/api/v1/coupons` | `coupons:write` | Create a coupon |
| GET | `/api/v1/quotes` | `quotes:read` | List quotes |
| POST | `/api/v1/quotes` | `quotes:write` | Create a quote |
| GET | `/api/v1/knowledgebase` | `knowledgebase:read` | Published articles (filter `?q=`) |
| GET | `/api/v1/tickets` | `tickets:read` | Tickets |
| POST | `/api/v1/tickets` | `tickets:write` | Open a ticket for a user |

List endpoints accept `?page=` and `?per_page=` (max 100) and return:

```json
{ "data": [ … ], "meta": { "page": 1, "per_page": 25, "total": 100 } }
```

## Example: create a ticket

```bash
curl -X POST https://your-host/api/v1/tickets \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{
    "user_id": "cku…",
    "subject": "Node maintenance window",
    "message": "Your node reboots at 02:00 UTC.",
    "priority": "HIGH"
  }'
```

## Errors

- `401 Unauthorized` — missing/invalid key, or the key lacks the required scope.
- `404 Not found` — the resource doesn't exist.
- `422 Unprocessable` — invalid request body (with `issues` detail).

## System endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/cron` | `Bearer $CRON_SECRET` | [Billing tick](../billing/automation.md) |
| POST | `/api/webhooks/:gateway` | gateway-specific | Payment confirmations |

## OAuth

To let another application sign users in *with* their OpenHosting account (SSO),
use the [OAuth2 provider](oauth.md) instead of API keys.
