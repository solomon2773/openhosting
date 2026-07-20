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
| GET | `/api/v1/orders` | `orders:read` | Orders with line items |
| GET | `/api/v1/invoices` | `invoices:read` | Invoices (filter `?status=PENDING`) |
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
