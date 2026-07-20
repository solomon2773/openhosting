import type { ServerDriver } from "@/lib/extensions/types";
import type { Service } from "@/generated/prisma/client";
import { randomBytes } from "node:crypto";

// HestiaCP admin API (/api/, hash or user/password auth, form-encoded).
async function hestia(
  config: Record<string, string>,
  cmd: string,
  args: string[],
) {
  const base = config.host?.replace(/\/$/, "");
  const body = new URLSearchParams();
  if (config.access_key && config.secret_key) {
    body.set("access_key", config.access_key);
    body.set("secret_key", config.secret_key);
  } else {
    body.set("user", config.username);
    body.set("password", config.password);
  }
  body.set("returncode", "yes");
  body.set("cmd", cmd);
  args.forEach((a, i) => body.set(`arg${i + 1}`, a));
  const res = await fetch(`${base}/api/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = (await res.text()).trim();
  if (text !== "0" && text !== "") {
    throw new Error(`HestiaCP ${cmd} failed: code ${text}`);
  }
}

function accountFor(service: Service): { user: string; domain: string } {
  const entries =
    (service.config as Array<{ envKey?: string; value: string }> | null) ?? [];
  const domain =
    entries.find((e) => e.envKey === "DOMAIN")?.value ??
    `svc-${service.id.slice(-8)}.example.com`;
  return { user: `oh${service.id.slice(-6)}`.toLowerCase(), domain };
}

export const hestiaCpServer: ServerDriver = {
  slug: "hestiacp",
  name: "HestiaCP",
  configFields: [
    { key: "host", label: "Panel URL", type: "text", required: true, help: "e.g. https://server.example.com:8083" },
    { key: "access_key", label: "Access key (preferred)", type: "password" },
    { key: "secret_key", label: "Secret key", type: "password" },
    { key: "username", label: "Admin user (if no keys)", type: "text" },
    { key: "password", label: "Admin password (if no keys)", type: "password" },
  ],
  productConfigFields: [
    { key: "package", label: "Package name", type: "text", required: true },
  ],
  async create(service, config, productConfig) {
    const { user, domain } = accountFor(service);
    await hestia(config, "v-add-user", [
      user,
      randomBytes(12).toString("base64url"),
      service.user.email,
      productConfig.package,
    ]);
    await hestia(config, "v-add-web-domain", [user, domain]);
    return user;
  },
  async suspend(service, config) {
    if (!service.externalId) return;
    await hestia(config, "v-suspend-user", [service.externalId]);
  },
  async unsuspend(service, config) {
    if (!service.externalId) return;
    await hestia(config, "v-unsuspend-user", [service.externalId]);
  },
  async terminate(service, config) {
    if (!service.externalId) return;
    await hestia(config, "v-delete-user", [service.externalId]);
  },
};
