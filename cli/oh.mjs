#!/usr/bin/env node
// OpenHosting CLI — manage a deployment from the terminal over its REST API.
//
//   oh <resource> <action> [args] [--flags]
//
// Configure with env vars (OPENHOSTING_URL, OPENHOSTING_API_KEY,
// OPENHOSTING_CRON_SECRET) or `oh config`. Add --json for raw output.

import { OpenHostingClient } from "./client.mjs";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CONFIG_DIR = join(homedir(), ".openhosting");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

function loadConfig() {
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    return {};
  }
}
function saveConfig(cfg) {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

// ── arg parsing ───────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flags = {};
const positional = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith("--")) {
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) flags[key] = true;
    else { flags[key] = next; i++; }
  } else positional.push(a);
}
const [resource, action, ...rest] = positional;
const asJson = Boolean(flags.json);

// ── output helpers ──────────────────────────────────────────────────────────
function out(data) {
  if (asJson) { console.log(JSON.stringify(data, null, 2)); return; }
  const rows = Array.isArray(data) ? data : data?.data ?? data;
  if (Array.isArray(rows)) { printTable(rows); if (data?.meta) console.log(`\n${data.meta.total} total (page ${data.meta.page})`); }
  else console.log(JSON.stringify(rows, null, 2));
}
function printTable(rows) {
  if (rows.length === 0) { console.log("(no results)"); return; }
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((c) => typeof rows[0][c] !== "object");
  const widths = cols.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c] ?? "").length)));
  const line = (cells) => cells.map((v, i) => String(v ?? "").padEnd(widths[i])).join("  ");
  console.log(line(cols));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  for (const r of rows) console.log(line(cols.map((c) => r[c])));
}
function fail(msg) { console.error("Error:", msg); process.exit(1); }

const HELP = `OpenHosting CLI

Usage: oh <resource> <action> [args] [--flags]

Config:
  oh config set --url <url> --api-key <key> [--cron-secret <secret>]
  oh config show

Resources:
  users     list [--q <search>] | get <id> | create --email --password --first --last
  products  list
  categories list
  orders    list
  invoices  list [--status <s>] | get <id> | pay <id>
  services  list [--status <s>] [--user <id>] | get <id>
            | suspend <id> | unsuspend <id> | terminate <id>
            | usage <id> <quantity> [--desc <text>]
  coupons   list | create --code <c> --type PERCENT|FIXED --value <n>
  quotes    list
  tickets   list
  kb        search <query>
  cron      run

Global flags:  --json   raw JSON output
Env: OPENHOSTING_URL, OPENHOSTING_API_KEY, OPENHOSTING_CRON_SECRET`;

// ── config command ──────────────────────────────────────────────────────────
if (!resource || resource === "help" || flags.help) { console.log(HELP); process.exit(0); }

if (resource === "config") {
  const cfg = loadConfig();
  if (action === "set") {
    if (flags.url) cfg.url = flags.url;
    if (flags["api-key"]) cfg.apiKey = flags["api-key"];
    if (flags["cron-secret"]) cfg.cronSecret = flags["cron-secret"];
    saveConfig(cfg);
    console.log(`Saved to ${CONFIG_FILE}`);
  } else {
    console.log(JSON.stringify({ ...cfg, apiKey: cfg.apiKey ? "oh_…" : undefined }, null, 2));
  }
  process.exit(0);
}

// client from env, falling back to saved config
const cfg = loadConfig();
const client = new OpenHostingClient({
  url: process.env.OPENHOSTING_URL ?? cfg.url,
  apiKey: process.env.OPENHOSTING_API_KEY ?? cfg.apiKey,
  cronSecret: process.env.OPENHOSTING_CRON_SECRET ?? cfg.cronSecret,
});

// ── dispatch ──────────────────────────────────────────────────────────────
try {
  const r = resource, a = action;
  if (r === "users" && a === "list") out(await client.listUsers({ q: flags.q }));
  else if (r === "users" && a === "get") out(await client.getUser(rest[0] ?? fail("need <id>")));
  else if (r === "users" && a === "create")
    out(await client.createUser({ email: flags.email, password: flags.password, first_name: flags.first, last_name: flags.last, country: flags.country }));
  else if (r === "products" && a === "list") out(await client.listProducts());
  else if (r === "categories" && a === "list") out(await client.listCategories());
  else if (r === "orders" && a === "list") out(await client.listOrders({}));
  else if (r === "invoices" && a === "list") out(await client.listInvoices({ status: flags.status }));
  else if (r === "invoices" && a === "get") out(await client.getInvoice(rest[0] ?? fail("need <id>")));
  else if (r === "invoices" && a === "pay") out(await client.markInvoicePaid(rest[0] ?? fail("need <id>")));
  else if (r === "services" && a === "list") out(await client.listServices({ status: flags.status, user_id: flags.user }));
  else if (r === "services" && a === "get") out(await client.getService(rest[0] ?? fail("need <id>")));
  else if (r === "services" && ["suspend", "unsuspend", "terminate"].includes(a)) out(await client.serviceAction(rest[0] ?? fail("need <id>"), a));
  else if (r === "services" && a === "usage") out(await client.pushUsage(rest[0] ?? fail("need <id>"), Number(rest[1] ?? fail("need <quantity>")), flags.desc));
  else if (r === "coupons" && a === "list") out(await client.listCoupons());
  else if (r === "coupons" && a === "create") out(await client.createCoupon({ code: flags.code, type: flags.type, value: Number(flags.value) }));
  else if (r === "quotes" && a === "list") out(await client.listQuotes({}));
  else if (r === "tickets" && a === "list") out(await client.listTickets({}));
  else if (r === "kb" && a === "search") out(await client.searchKnowledgebase(rest[0] ?? ""));
  else if (r === "cron" && a === "run") out(await client.runCron());
  else fail(`Unknown command: ${r} ${a ?? ""}. Run 'oh help'.`);
} catch (err) {
  fail(err.message);
}
