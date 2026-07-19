import type { ServerDriver } from "@/lib/extensions/types";
import type { Service } from "@/generated/prisma/client";

// cPanel/WHM via the WHM API 1 (token auth).
async function whm(
  config: Record<string, string>,
  fn: string,
  params: Record<string, string>,
) {
  const base = config.host?.replace(/\/$/, "");
  const query = new URLSearchParams({ "api.version": "1", ...params });
  const res = await fetch(`${base}/json-api/${fn}?${query}`, {
    headers: {
      Authorization: `whm ${config.username}:${config.api_token}`,
    },
  });
  if (!res.ok) throw new Error(`WHM ${fn} failed: HTTP ${res.status}`);
  const data = await res.json();
  if (data.metadata?.result !== 1) {
    throw new Error(`WHM ${fn} failed: ${data.metadata?.reason ?? "unknown"}`);
  }
  return data;
}

// cPanel usernames: max 16 chars, start with a letter, lowercase alnum.
function usernameFor(service: Service): string {
  return `oh${service.id.replace(/[^a-z0-9]/gi, "").slice(-10)}`.toLowerCase();
}

function domainFor(service: Service): string {
  const entries =
    (service.config as Array<{ envKey?: string; value: string }> | null) ?? [];
  const domain = entries.find((e) => e.envKey === "DOMAIN")?.value;
  return domain ?? `${usernameFor(service)}.example.com`;
}

export const cpanelServer: ServerDriver = {
  slug: "cpanel",
  name: "cPanel/WHM",
  configFields: [
    { key: "host", label: "WHM URL", type: "text", required: true, help: "e.g. https://server.example.com:2087" },
    { key: "username", label: "WHM username", type: "text", required: true },
    { key: "api_token", label: "API token", type: "password", required: true },
  ],
  productConfigFields: [
    { key: "plan", label: "Package/plan name", type: "text", required: true },
    {
      key: "domain_option",
      label: "Domain config option env key",
      type: "text",
      help: "Add a config option with env key DOMAIN so customers enter their domain at checkout.",
    },
  ],
  async create(service, config, productConfig) {
    const username = usernameFor(service);
    await whm(config, "createacct", {
      username,
      domain: domainFor(service),
      plan: productConfig.plan,
      contactemail: service.user.email,
    });
    return username;
  },
  async suspend(service, config) {
    if (!service.externalId) return;
    await whm(config, "suspendacct", {
      user: service.externalId,
      reason: "Unpaid invoice",
    });
  },
  async unsuspend(service, config) {
    if (!service.externalId) return;
    await whm(config, "unsuspendacct", { user: service.externalId });
  },
  async terminate(service, config) {
    if (!service.externalId) return;
    await whm(config, "removeacct", { user: service.externalId });
  },
};
