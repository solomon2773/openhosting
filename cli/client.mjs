// Shared REST client for the OpenHosting CLI and MCP server. Zero dependencies
// (Node 24 global fetch). Configured via env or explicit options:
//   OPENHOSTING_URL       base URL, e.g. https://billing.example.com
//   OPENHOSTING_API_KEY   an API key (oh_…) created under Admin → API keys
//   OPENHOSTING_CRON_SECRET  the CRON_SECRET, for `cron run`

export class OpenHostingClient {
  /** @param {{ url?: string, apiKey?: string, cronSecret?: string }} [opts] */
  constructor(opts = {}) {
    this.url = (opts.url ?? process.env.OPENHOSTING_URL ?? "http://localhost:3000").replace(/\/$/, "");
    this.apiKey = opts.apiKey ?? process.env.OPENHOSTING_API_KEY ?? "";
    this.cronSecret = opts.cronSecret ?? process.env.OPENHOSTING_CRON_SECRET ?? "";
  }

  /** @param {string} path @param {{ method?: string, body?: unknown, query?: Record<string,string|number|undefined> }} [opts] */
  async request(path, opts = {}) {
    if (!this.apiKey) {
      throw new Error("No API key. Set OPENHOSTING_API_KEY (create one under Admin → API keys).");
    }
    const query = opts.query
      ? "?" + new URLSearchParams(
          Object.entries(opts.query)
            .filter(([, v]) => v !== undefined && v !== "")
            .map(([k, v]) => [k, String(v)]),
        )
      : "";
    const res = await fetch(`${this.url}/api/v1${path}${query}`, {
      method: opts.method ?? "GET",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        ...(opts.body ? { "Content-Type": "application/json" } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      const msg = data?.error ?? `HTTP ${res.status}`;
      throw new Error(`${msg}${data?.issues ? ": " + JSON.stringify(data.issues) : ""}`);
    }
    return data;
  }

  // ── Read ──────────────────────────────────────────────────────────────────
  listUsers(query) { return this.request("/users", { query }); }
  getUser(id) { return this.request(`/users/${id}`); }
  listProducts() { return this.request("/products"); }
  listCategories() { return this.request("/categories"); }
  listOrders(query) { return this.request("/orders", { query }); }
  listInvoices(query) { return this.request("/invoices", { query }); }
  getInvoice(id) { return this.request(`/invoices/${id}`); }
  listServices(query) { return this.request("/services", { query }); }
  getService(id) { return this.request(`/services/${id}`); }
  listCoupons() { return this.request("/coupons"); }
  listQuotes(query) { return this.request("/quotes", { query }); }
  listTickets(query) { return this.request("/tickets", { query }); }
  searchKnowledgebase(q) { return this.request("/knowledgebase", { query: { q } }); }

  // ── Write ─────────────────────────────────────────────────────────────────
  createUser(body) { return this.request("/users", { method: "POST", body }); }
  markInvoicePaid(id) { return this.request(`/invoices/${id}`, { method: "POST" }); }
  serviceAction(id, action) { return this.request(`/services/${id}`, { method: "POST", body: { action } }); }
  pushUsage(id, quantity, description) {
    return this.request(`/services/${id}/usage`, { method: "POST", body: { quantity, description } });
  }
  createCoupon(body) { return this.request("/coupons", { method: "POST", body }); }
  createQuote(body) { return this.request("/quotes", { method: "POST", body }); }
  createTicket(body) { return this.request("/tickets", { method: "POST", body }); }

  // ── System ────────────────────────────────────────────────────────────────
  async runCron() {
    if (!this.cronSecret) throw new Error("Set OPENHOSTING_CRON_SECRET to run the billing cron.");
    const res = await fetch(`${this.url}/api/cron`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.cronSecret}` },
    });
    if (!res.ok) throw new Error(`Cron failed: HTTP ${res.status}`);
    return res.json();
  }
}
