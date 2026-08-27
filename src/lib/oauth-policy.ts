import { createHash, timingSafeEqual } from "node:crypto";

export const MCP_TOOL_NAMES = [
  "list_users",
  "get_user",
  "create_user",
  "list_products",
  "list_categories",
  "list_orders",
  "list_invoices",
  "get_invoice",
  "mark_invoice_paid",
  "list_services",
  "get_service",
  "service_action",
  "push_usage",
  "list_coupons",
  "create_coupon",
  "list_quotes",
  "create_quote",
  "list_tickets",
  "create_ticket",
  "search_knowledgebase",
  "run_billing_cron",
] as const;

export type McpToolName = (typeof MCP_TOOL_NAMES)[number];

export const OAUTH_STANDARD_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
] as const;

export const MCP_TOOL_SCOPES = MCP_TOOL_NAMES.map(
  (tool) => `mcp:tool:${tool}` as const,
);

export const OAUTH_SUPPORTED_SCOPES: readonly string[] = [
  ...OAUTH_STANDARD_SCOPES,
  ...MCP_TOOL_SCOPES,
];

export function mcpToolScope(tool: McpToolName): `mcp:tool:${McpToolName}` {
  return `mcp:tool:${tool}`;
}

export function requestedOauthScopes(
  requested: string | null | undefined,
  allowedScopes: readonly string[],
): string[] | null {
  const scopes = [
    ...new Set(
      (requested?.trim() || "openid profile email")
        .split(/\s+/)
        .filter(Boolean),
    ),
  ];
  if (
    scopes.length === 0 ||
    scopes.some(
      (scope) =>
        !OAUTH_SUPPORTED_SCOPES.includes(scope) || !allowedScopes.includes(scope),
    )
  ) {
    return null;
  }
  return scopes;
}

export function verifyPkceS256(
  codeVerifier: string,
  expectedChallenge: string,
): boolean {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(codeVerifier)) return false;
  const actual = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  const left = Buffer.from(actual);
  const right = Buffer.from(expectedChallenge);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function canonicalMcpResource(origin: string): string {
  return `${origin.replace(/\/+$/, "")}/api/mcp`;
}

export function isAllowedMcpOrigin(
  requestOrigin: string | null,
  serverOrigin: string,
  configuredOrigins: string | undefined,
): boolean {
  if (!requestOrigin) return true;
  const allowed = new Set([
    serverOrigin,
    ...(configuredOrigins ?? "")
      .split(",")
      .map((origin) => origin.trim().replace(/\/+$/, ""))
      .filter(Boolean),
  ]);
  return allowed.has(requestOrigin.replace(/\/+$/, ""));
}

export function mcpToolForApiRequest(
  method: string,
  pathname: string,
): McpToolName | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (method === "POST" && path === "/api/cron") return "run_billing_cron";
  if (method === "GET" && path === "/api/v1/users") return "list_users";
  if (method === "GET" && /^\/api\/v1\/users\/[^/]+$/.test(path)) return "get_user";
  if (method === "POST" && path === "/api/v1/users") return "create_user";
  if (method === "GET" && path === "/api/v1/products") return "list_products";
  if (method === "GET" && path === "/api/v1/categories") return "list_categories";
  if (method === "GET" && path === "/api/v1/orders") return "list_orders";
  if (method === "GET" && path === "/api/v1/invoices") return "list_invoices";
  if (method === "GET" && /^\/api\/v1\/invoices\/[^/]+$/.test(path)) return "get_invoice";
  if (method === "POST" && /^\/api\/v1\/invoices\/[^/]+$/.test(path)) return "mark_invoice_paid";
  if (method === "GET" && path === "/api/v1/services") return "list_services";
  if (method === "GET" && /^\/api\/v1\/services\/[^/]+$/.test(path)) return "get_service";
  if (method === "POST" && /^\/api\/v1\/services\/[^/]+$/.test(path)) return "service_action";
  if (method === "POST" && /^\/api\/v1\/services\/[^/]+\/usage$/.test(path)) return "push_usage";
  if (method === "GET" && path === "/api/v1/coupons") return "list_coupons";
  if (method === "POST" && path === "/api/v1/coupons") return "create_coupon";
  if (method === "GET" && path === "/api/v1/quotes") return "list_quotes";
  if (method === "POST" && path === "/api/v1/quotes") return "create_quote";
  if (method === "GET" && path === "/api/v1/tickets") return "list_tickets";
  if (method === "POST" && path === "/api/v1/tickets") return "create_ticket";
  if (method === "GET" && path === "/api/v1/knowledgebase") return "search_knowledgebase";
  return null;
}
