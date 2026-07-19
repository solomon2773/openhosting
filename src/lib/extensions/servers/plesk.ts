import type { ServerDriver } from "@/lib/extensions/types";
import type { Service } from "@prisma/client";
import { randomBytes } from "node:crypto";

// Plesk REST API (/api/v2) with basic auth or API key.
async function plesk(
  config: Record<string, string>,
  method: string,
  path: string,
  body?: unknown,
) {
  const base = config.host?.replace(/\/$/, "");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (config.api_key) {
    headers["X-API-Key"] = config.api_key;
  } else {
    headers.Authorization = `Basic ${Buffer.from(
      `${config.username}:${config.password}`,
    ).toString("base64")}`;
  }
  const res = await fetch(`${base}/api/v2${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Plesk ${method} ${path} failed: ${res.status} ${detail}`);
  }
  return res.status === 204 ? null : res.json();
}

function domainFor(service: Service): string {
  const entries =
    (service.config as Array<{ envKey?: string; value: string }> | null) ?? [];
  return (
    entries.find((e) => e.envKey === "DOMAIN")?.value ??
    `oh-${service.id.slice(-8)}.example.com`
  );
}

export const pleskServer: ServerDriver = {
  slug: "plesk",
  name: "Plesk",
  configFields: [
    { key: "host", label: "Plesk URL", type: "text", required: true, help: "e.g. https://server.example.com:8443" },
    { key: "api_key", label: "API key (preferred)", type: "password" },
    { key: "username", label: "Admin username (if no API key)", type: "text" },
    { key: "password", label: "Admin password (if no API key)", type: "password" },
  ],
  productConfigFields: [
    { key: "service_plan", label: "Service plan name", type: "text", required: true },
    { key: "ip", label: "IP address", type: "text", required: true },
  ],
  async create(service, config, productConfig) {
    const domain = domainFor(service);
    const login = `oh_${service.id.slice(-8)}`.toLowerCase();
    await plesk(config, "POST", "/domains", {
      name: domain,
      hosting_type: "virtual",
      hosting_settings: {
        ftp_login: login,
        ftp_password: randomBytes(12).toString("base64url"),
      },
      ip_addresses: [productConfig.ip],
      plan: { name: productConfig.service_plan },
      owner_client: {
        // create-or-reuse a customer keyed on the user's email
        login: service.user.email.replace(/[^a-z0-9]/gi, "_").slice(0, 20),
        name: `${service.user.firstName} ${service.user.lastName}`,
        email: service.user.email,
      },
    });
    return domain;
  },
  async suspend(service, config) {
    if (!service.externalId) return;
    await plesk(config, "PUT", `/domains/${encodeURIComponent(service.externalId)}/status`, {
      status: "suspended",
    });
  },
  async unsuspend(service, config) {
    if (!service.externalId) return;
    await plesk(config, "PUT", `/domains/${encodeURIComponent(service.externalId)}/status`, {
      status: "active",
    });
  },
  async terminate(service, config) {
    if (!service.externalId) return;
    await plesk(config, "DELETE", `/domains/${encodeURIComponent(service.externalId)}`);
  },
};
