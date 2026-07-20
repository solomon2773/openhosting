# MCP server

OpenHosting includes a [Model Context Protocol](https://modelcontextprotocol.io)
server, exposing the platform's operations as tools that AI assistants — Claude
Desktop, Claude Code, Cursor, or any MCP client — can call. This lets an
assistant manage your hosting business conversationally: look up customers,
control services, handle billing, and answer support questions.

## What it exposes

21 tools, mirroring the [REST API](api/rest-api.md):

| Area | Tools |
|---|---|
| Customers | `list_users`, `get_user`, `create_user` |
| Catalog | `list_products`, `list_categories` |
| Orders & invoices | `list_orders`, `list_invoices`, `get_invoice`, `mark_invoice_paid` |
| Services | `list_services`, `get_service`, `service_action`, `push_usage` |
| Promotions | `list_coupons`, `create_coupon` |
| Quotes | `list_quotes`, `create_quote` |
| Support | `list_tickets`, `create_ticket`, `search_knowledgebase` |
| Billing | `run_billing_cron` |

Each tool has a typed input schema and returns JSON, so the assistant gets
structured results it can reason over.

## Setup

The server needs a base URL and an API key (create one under
**Admin → API keys**). It runs over stdio, launched by the MCP client with
environment variables.

### Claude Desktop / Claude Code

Add to your MCP configuration (e.g. `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "openhosting": {
      "command": "node",
      "args": ["/absolute/path/to/openhosting/mcp/server.mjs"],
      "env": {
        "OPENHOSTING_URL": "https://billing.example.com",
        "OPENHOSTING_API_KEY": "oh_xxxxxxxx…",
        "OPENHOSTING_CRON_SECRET": "…"
      }
    }
  }
}
```

Restart the client; the OpenHosting tools appear in its tool list.

### Any MCP client

Launch `node mcp/server.mjs` with the same environment variables. It speaks MCP
over stdio (stdout is the protocol channel; logs go to stderr).

## Example prompts

Once connected, you can ask the assistant things like:

- *"How many services are suspended right now?"* → `list_services status=SUSPENDED`
- *"Suspend service cku456 — the customer's card bounced."* → `service_action`
- *"Create a 20%-off coupon called BLACKFRIDAY."* → `create_coupon`
- *"Draft a quote for customer cku123 for a custom migration at $500."* → `create_quote`
- *"A customer asks how to reset their password — what should I tell them?"* → `search_knowledgebase`
- *"Run the billing cycle now."* → `run_billing_cron`

## Permissions & safety

The server can only do what its API key's [scopes](api/rest-api.md) permit —
give it a read-only key to let an assistant investigate without being able to
change anything, or a scoped write key for the specific operations you want to
automate.

Destructive tools (`service_action` with `terminate`, `mark_invoice_paid`)
carry warnings in their descriptions so the assistant treats them carefully, but
scoping the key is the real safety boundary. For non-AI automation, the same
operations are available through the [CLI](cli.md) and [REST API](api/rest-api.md).
