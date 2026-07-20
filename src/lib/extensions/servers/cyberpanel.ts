import type { ServerDriver } from "@/lib/extensions/types";
import type { Service } from "@/generated/prisma/client";
import { randomBytes } from "node:crypto";

// CyberPanel cloud API (/api/, admin user + password, JSON).
async function cyberpanel(
  config: Record<string, string>,
  path: string,
  payload: Record<string, unknown>,
) {
  const base = config.host?.replace(/\/$/, "");
  const res = await fetch(`${base}/api/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      adminUser: config.username,
      adminPass: config.password,
      ...payload,
    }),
  });
  if (!res.ok) throw new Error(`CyberPanel ${path} failed: ${res.status}`);
  const data = await res.json();
  if (data.status !== 1 && data.success !== 1) {
    throw new Error(`CyberPanel ${path} failed: ${data.error_message ?? "unknown"}`);
  }
  return data;
}

function domainFor(service: Service): string {
  const entries =
    (service.config as Array<{ envKey?: string; value: string }> | null) ?? [];
  return (
    entries.find((e) => e.envKey === "DOMAIN")?.value ??
    `svc-${service.id.slice(-8)}.example.com`
  );
}

export const cyberPanelServer: ServerDriver = {
  slug: "cyberpanel",
  name: "CyberPanel",
  configFields: [
    { key: "host", label: "Panel URL", type: "text", required: true, help: "e.g. https://server.example.com:8090" },
    { key: "username", label: "Admin username", type: "text", required: true },
    { key: "password", label: "Admin password", type: "password", required: true },
  ],
  productConfigFields: [
    { key: "package", label: "Package name", type: "text", required: true },
    { key: "php", label: "PHP version", type: "text", help: "e.g. PHP 8.2" },
  ],
  async create(service, config, productConfig) {
    const domain = domainFor(service);
    await cyberpanel(config, "createWebsite", {
      domainName: domain,
      ownerEmail: service.user.email,
      packageName: productConfig.package,
      websiteOwner: `oh${service.id.slice(-6)}`,
      ownerPassword: randomBytes(12).toString("base64url"),
      phpSelection: productConfig.php || "PHP 8.2",
    });
    return domain;
  },
  async suspend(service, config) {
    if (!service.externalId) return;
    await cyberpanel(config, "submitWebsiteStatus", {
      websiteName: service.externalId,
      state: "Suspend",
    });
  },
  async unsuspend(service, config) {
    if (!service.externalId) return;
    await cyberpanel(config, "submitWebsiteStatus", {
      websiteName: service.externalId,
      state: "Unsuspend",
    });
  },
  async terminate(service, config) {
    if (!service.externalId) return;
    await cyberpanel(config, "deleteWebsite", { domainName: service.externalId });
  },
};
