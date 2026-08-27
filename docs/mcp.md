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

OpenHosting supports two transports:

- local **stdio**, authenticated with an API key; and
- hosted **Streamable HTTP** at `/api/mcp`, authenticated through OAuth 2.1.

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

### Remote Streamable HTTP

1. Under **Admin → OAuth clients**, create a public PKCE client (or a
   confidential client when your MCP client can protect a secret).
2. Register the MCP client's exact redirect URI.
3. Allow only the `mcp:tool:<tool_name>` scopes it needs. For example, a
   read-only customer lookup client might receive
   `mcp:tool:list_users mcp:tool:get_user`.
4. Configure the client with `https://your-host/api/mcp`.

The unauthenticated endpoint returns a `WWW-Authenticate` challenge pointing to
OAuth Protected Resource Metadata. Discovery documents are available at:

- `/.well-known/oauth-protected-resource`
- `/.well-known/oauth-protected-resource/api/mcp`
- `/.well-known/oauth-authorization-server`

Remote authorization requires S256 PKCE. MCP tokens are audience-bound to the
canonical `/api/mcp` resource, expire after one hour, and include a rotating
30-day refresh token. The HTTP server is stateless and returns JSON for ordinary
tool calls; it validates any browser `Origin` against the configured public
origin plus `MCP_ALLOWED_ORIGINS`.

## Example prompts

Once connected, you can ask the assistant things like:

- *"How many services are suspended right now?"* → `list_services status=SUSPENDED`
- *"Suspend service cku456 — the customer's card bounced."* → `service_action`
- *"Create a 20%-off coupon called BLACKFRIDAY."* → `create_coupon`
- *"Draft a quote for customer cku123 for a custom migration at $500."* → `create_quote`
- *"A customer asks how to reset their password — what should I tell them?"* → `search_knowledgebase`
- *"Run the billing cycle now."* → `run_billing_cron`

## Permissions & safety

The stdio server can only do what its API key's [scopes](api/rest-api.md)
permit. Remote clients have a narrower boundary: only tools whose exact
`mcp:tool:<name>` scopes were approved are registered for that request, and the
same token cannot use a sibling REST operation that shares a broader domain
permission.

Destructive tools (`service_action` with `terminate`, `mark_invoice_paid`)
carry warnings in their descriptions so the assistant treats them carefully, but
scoping the key is the real safety boundary. For non-AI automation, the same
operations are available through the [CLI](cli.md) and [REST API](api/rest-api.md).
