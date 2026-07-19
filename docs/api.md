# REST API

Base URL: `https://your-host/api/v1`

## Authentication

Create a key under **Admin → API keys** (shown once), then send it as a
Bearer token:

```bash
curl -H "Authorization: Bearer oh_xxxxxxxx…" https://your-host/api/v1/products
```

Keys carry scoped permissions (`users:read`, `tickets:write`, …); a key with
no scopes selected has full access (`*`).

## Endpoints

| Method | Path | Scope | Description |
|---|---|---|---|
| GET | `/api/v1/users` | `users:read` | List users (paginated) |
| GET | `/api/v1/users/:id` | `users:read` | User with services + counts |
| GET | `/api/v1/products` | `products:read` | Catalog with all prices |
| GET | `/api/v1/orders` | `orders:read` | Orders with line items |
| GET | `/api/v1/invoices` | `invoices:read` | Invoices (`?status=PENDING`) |
| GET | `/api/v1/tickets` | `tickets:read` | Tickets |
| POST | `/api/v1/tickets` | `tickets:write` | Open a ticket for a user |

List endpoints accept `?page=` and `?per_page=` (max 100) and return
`{ data: [...], meta: { page, per_page, total } }`.

### Create a ticket

```bash
curl -X POST https://your-host/api/v1/tickets \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{
    "user_id": "cku…",
    "subject": "Node maintenance window",
    "message": "Your node will be rebooted at 02:00 UTC.",
    "priority": "HIGH"
  }'
```

## System endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/cron` | `Bearer $CRON_SECRET` | Billing tick (renewals/suspensions) |
| POST | `/api/webhooks/:gateway` | gateway-specific | Payment confirmations |
