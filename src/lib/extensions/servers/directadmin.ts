import type { ServerDriver } from "@/lib/extensions/types";
import type { Service } from "@prisma/client";
import { randomBytes } from "node:crypto";

// DirectAdmin via its CMD_API_* endpoints (basic auth with a login key).
async function da(
  config: Record<string, string>,
  cmd: string,
  params: Record<string, string>,
) {
  const base = config.host?.replace(/\/$/, "");
  const res = await fetch(`${base}/${cmd}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${config.username}:${config.login_key}`,
      ).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });
  if (!res.ok) throw new Error(`DirectAdmin ${cmd} failed: HTTP ${res.status}`);
  const text = await res.text();
  const parsed = new URLSearchParams(text);
  if (parsed.get("error") === "1") {
    throw new Error(
      `DirectAdmin ${cmd} failed: ${parsed.get("text") ?? "unknown"} ${parsed.get("details") ?? ""}`.trim(),
    );
  }
  return parsed;
}

function usernameFor(service: Service): string {
  return `oh${service.id.replace(/[^a-z0-9]/gi, "").slice(-8)}`.toLowerCase();
}

function domainFor(service: Service): string {
  const entries =
    (service.config as Array<{ envKey?: string; value: string }> | null) ?? [];
  return (
    entries.find((e) => e.envKey === "DOMAIN")?.value ??
    `${usernameFor(service)}.example.com`
  );
}

export const directAdminServer: ServerDriver = {
  slug: "directadmin",
  name: "DirectAdmin",
  configFields: [
    { key: "host", label: "Panel URL", type: "text", required: true, help: "e.g. https://server.example.com:2222" },
    { key: "username", label: "Admin username", type: "text", required: true },
    { key: "login_key", label: "Login key", type: "password", required: true },
  ],
  productConfigFields: [
    { key: "package", label: "Package name", type: "text", required: true },
    { key: "ip", label: "IP assignment", type: "text", help: "IP address or 'shared'", required: true },
  ],
  async create(service, config, productConfig) {
    const username = usernameFor(service);
    const password = randomBytes(12).toString("base64url");
    await da(config, "CMD_API_ACCOUNT_USER", {
      action: "create",
      add: "Submit",
      username,
      email: service.user.email,
      passwd: password,
      passwd2: password,
      domain: domainFor(service),
      package: productConfig.package,
      ip: productConfig.ip,
      notify: "yes",
    });
    return username;
  },
  async suspend(service, config) {
    if (!service.externalId) return;
    await da(config, "CMD_API_SELECT_USERS", {
      location: "CMD_SELECT_USERS",
      suspend: "Suspend",
      select0: service.externalId,
    });
  },
  async unsuspend(service, config) {
    if (!service.externalId) return;
    await da(config, "CMD_API_SELECT_USERS", {
      location: "CMD_SELECT_USERS",
      suspend: "Unsuspend",
      select0: service.externalId,
    });
  },
  async terminate(service, config) {
    if (!service.externalId) return;
    await da(config, "CMD_API_SELECT_USERS", {
      confirmed: "Confirm",
      delete: "yes",
      select0: service.externalId,
    });
  },
};
