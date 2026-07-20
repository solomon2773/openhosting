import type { ServerDriver } from "@/lib/extensions/types";
import type { Service } from "@/generated/prisma/client";
import { randomBytes } from "node:crypto";

// CentOS Web Panel (CWP) API (/v1/, api key auth, form-encoded, JSON out).
async function cwp(
  config: Record<string, string>,
  endpoint: string,
  params: Record<string, string>,
) {
  const base = config.host?.replace(/\/$/, "");
  const body = new URLSearchParams({ key: config.api_key, ...params });
  const res = await fetch(`${base}:2304/v1/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`CWP ${endpoint} failed: ${res.status}`);
  const data = await res.json().catch(() => ({ status: "Error" }));
  if (data.status !== "OK") {
    throw new Error(`CWP ${endpoint} failed: ${data.msj ?? JSON.stringify(data)}`);
  }
  return data;
}

function accountFor(service: Service): { user: string; domain: string } {
  const entries =
    (service.config as Array<{ envKey?: string; value: string }> | null) ?? [];
  const domain =
    entries.find((e) => e.envKey === "DOMAIN")?.value ??
    `svc-${service.id.slice(-8)}.example.com`;
  return { user: `oh${service.id.slice(-6)}`.toLowerCase(), domain };
}

export const cwpServer: ServerDriver = {
  slug: "cwp",
  name: "CentOS Web Panel",
  configFields: [
    { key: "host", label: "Server URL", type: "text", required: true, help: "e.g. https://server.example.com" },
    { key: "api_key", label: "API key", type: "password", required: true },
  ],
  productConfigFields: [
    { key: "package", label: "Package name", type: "text", required: true },
    { key: "server_ip", label: "Server IP", type: "text", required: true },
  ],
  async create(service, config, productConfig) {
    const { user, domain } = accountFor(service);
    await cwp(config, "account", {
      action: "add",
      user,
      pass: randomBytes(12).toString("base64url"),
      email: service.user.email,
      package: productConfig.package,
      domain,
      server_ips: productConfig.server_ip,
    });
    return user;
  },
  async suspend(service, config) {
    if (!service.externalId) return;
    await cwp(config, "account", { action: "susp", user: service.externalId });
  },
  async unsuspend(service, config) {
    if (!service.externalId) return;
    await cwp(config, "account", { action: "unsp", user: service.externalId });
  },
  async terminate(service, config) {
    if (!service.externalId) return;
    await cwp(config, "account", { action: "del", user: service.externalId });
  },
};
