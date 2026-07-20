#!/usr/bin/env node
// OpenHosting MCP server — exposes the platform's operations as Model Context
// Protocol tools so AI assistants (Claude Desktop, Claude Code, any MCP client)
// can manage a hosting business: look up customers, control services, handle
// billing, answer support questions, and more.
//
// Transport: stdio. Configure via env:
//   OPENHOSTING_URL, OPENHOSTING_API_KEY, OPENHOSTING_CRON_SECRET
//
// Example Claude Desktop config entry:
//   "openhosting": {
//     "command": "node",
//     "args": ["/path/to/openhosting/mcp/server.mjs"],
//     "env": { "OPENHOSTING_URL": "https://…", "OPENHOSTING_API_KEY": "oh_…" }
//   }

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { OpenHostingClient } from "../cli/client.mjs";

const client = new OpenHostingClient();

const server = new McpServer({
  name: "openhosting",
  version: "0.3.0",
});

// Wrap a client call so its JSON result becomes MCP text content, and errors
// become a readable tool error instead of crashing the connection.
function tool(name, config, fn) {
  server.registerTool(name, config, async (args) => {
    try {
      const result = await fn(args ?? {});
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  });
}

// ── Customers ────────────────────────────────────────────────────────────────
tool("list_users", {
  title: "List customers",
  description: "List customer accounts, optionally filtered by a search string (email or name). Paginated.",
  inputSchema: { q: z.string().optional(), page: z.number().optional(), per_page: z.number().optional() },
}, ({ q, page, per_page }) => client.listUsers({ q, page, per_page }));

tool("get_user", {
  title: "Get a customer",
  description: "Get a single customer by id, including their services and counts.",
  inputSchema: { id: z.string() },
}, ({ id }) => client.getUser(id));

tool("create_user", {
  title: "Create a customer",
  description: "Create a new customer account (email is marked verified).",
  inputSchema: {
    email: z.string().email(),
    password: z.string().min(8),
    first_name: z.string(),
    last_name: z.string(),
    country: z.string().optional(),
  },
}, (body) => client.createUser(body));

// ── Catalog ──────────────────────────────────────────────────────────────────
tool("list_products", {
  title: "List products",
  description: "List the product catalog with pricing for each billing cycle.",
  inputSchema: {},
}, () => client.listProducts());

tool("list_categories", {
  title: "List categories",
  description: "List product categories.",
  inputSchema: {},
}, () => client.listCategories());

// ── Orders & invoices ────────────────────────────────────────────────────────
tool("list_orders", {
  title: "List orders",
  description: "List recent orders with their line items and totals.",
  inputSchema: { page: z.number().optional() },
}, ({ page }) => client.listOrders({ page }));

tool("list_invoices", {
  title: "List invoices",
  description: "List invoices, optionally filtered by status (PENDING, PAID, CANCELLED, REFUNDED).",
  inputSchema: { status: z.string().optional(), page: z.number().optional() },
}, ({ status, page }) => client.listInvoices({ status, page }));

tool("get_invoice", {
  title: "Get an invoice",
  description: "Get a single invoice by id, including its line items and payments.",
  inputSchema: { id: z.string() },
}, ({ id }) => client.getInvoice(id));

tool("mark_invoice_paid", {
  title: "Mark an invoice paid",
  description: "Record an off-platform payment for a pending invoice, activating its services. Use with care — this triggers provisioning.",
  inputSchema: { id: z.string() },
}, ({ id }) => client.markInvoicePaid(id));

// ── Services ─────────────────────────────────────────────────────────────────
tool("list_services", {
  title: "List services",
  description: "List provisioned services, optionally filtered by status or customer.",
  inputSchema: { status: z.string().optional(), user_id: z.string().optional(), page: z.number().optional() },
}, ({ status, user_id, page }) => client.listServices({ status, user_id, page }));

tool("get_service", {
  title: "Get a service",
  description: "Get a service by id, including current unbilled metered usage.",
  inputSchema: { id: z.string() },
}, ({ id }) => client.getService(id));

tool("service_action", {
  title: "Control a service",
  description: "Suspend, unsuspend, or terminate a service. This calls the real provisioning backend — suspending a VPS powers it off, terminating deletes it.",
  inputSchema: { id: z.string(), action: z.enum(["suspend", "unsuspend", "terminate"]) },
}, ({ id, action }) => client.serviceAction(id, action));

tool("push_usage", {
  title: "Record metered usage",
  description: "Record a metered usage data point for a service (added to its next renewal invoice). The product must be metered.",
  inputSchema: { service_id: z.string(), quantity: z.number().positive(), description: z.string().optional() },
}, ({ service_id, quantity, description }) => client.pushUsage(service_id, quantity, description));

// ── Promotions ───────────────────────────────────────────────────────────────
tool("list_coupons", {
  title: "List coupons",
  description: "List discount coupons.",
  inputSchema: {},
}, () => client.listCoupons());

tool("create_coupon", {
  title: "Create a coupon",
  description: "Create a discount coupon.",
  inputSchema: {
    code: z.string(),
    type: z.enum(["PERCENT", "FIXED"]),
    value: z.number().nonnegative(),
    max_uses: z.number().optional(),
    expires_at: z.string().optional(),
  },
}, (body) => client.createCoupon(body));

// ── Quotes ───────────────────────────────────────────────────────────────────
tool("list_quotes", {
  title: "List quotes",
  description: "List sales quotes / estimates.",
  inputSchema: { page: z.number().optional() },
}, ({ page }) => client.listQuotes({ page }));

tool("create_quote", {
  title: "Create a quote",
  description: "Create a quote for a customer with line items. They can accept it to generate an invoice.",
  inputSchema: {
    user_id: z.string(),
    notes: z.string().optional(),
    valid_until: z.string().optional(),
    items: z.array(z.object({
      description: z.string(),
      quantity: z.number().int().positive().default(1),
      unit_price: z.number().nonnegative(),
    })),
  },
}, (body) => client.createQuote(body));

// ── Support ──────────────────────────────────────────────────────────────────
tool("list_tickets", {
  title: "List support tickets",
  description: "List support tickets.",
  inputSchema: { page: z.number().optional() },
}, ({ page }) => client.listTickets({ page }));

tool("create_ticket", {
  title: "Open a support ticket",
  description: "Open a support ticket on behalf of a customer.",
  inputSchema: {
    user_id: z.string(),
    subject: z.string(),
    message: z.string(),
    department: z.string().optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  },
}, (body) => client.createTicket(body));

tool("search_knowledgebase", {
  title: "Search the knowledgebase",
  description: "Search published knowledgebase articles — useful for answering customer questions.",
  inputSchema: { query: z.string() },
}, ({ query }) => client.searchKnowledgebase(query));

// ── Billing ──────────────────────────────────────────────────────────────────
tool("run_billing_cron", {
  title: "Run the billing cron",
  description: "Trigger the recurring-billing tick: generate renewal invoices, auto-charge saved cards, and process suspensions/terminations. Requires OPENHOSTING_CRON_SECRET.",
  inputSchema: {},
}, () => client.runCron());

// ── Start ────────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
// stderr is safe for logs (stdout is the MCP channel)
console.error("OpenHosting MCP server running on stdio.");
