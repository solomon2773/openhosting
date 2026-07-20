import type { ServerDriver } from "@/lib/extensions/types";
import type { Service } from "@/generated/prisma/client";
import { randomBytes } from "node:crypto";

// InterWorx NodeWorx remote API (/nodeworx/, JSON-RPC-ish over form POST with
// an API key).
async function iworx(
  config: Record<string, string>,
  ctrl: string,
  action: string,
  input: Record<string, string>,
) {
  const base = config.host?.replace(/\/$/, "");
  const res = await fetch(`${base}/nodeworx/?api=json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      request: {
        apikey: config.api_key,
        ctrl_name: ctrl,
        action,
        input,
      },
    }),
  });
  if (!res.ok) throw new Error(`InterWorx ${ctrl}/${action} failed: ${res.status}`);
  const data = await res.json();
  if (data?.response?.status !== 0) {
    throw new Error(`InterWorx ${ctrl}/${action} failed: ${JSON.stringify(data?.response?.payload ?? data)}`);
  }
  return data.response;
}

function accountFor(service: Service): { domain: string } {
  const entries =
    (service.config as Array<{ envKey?: string; value: string }> | null) ?? [];
  return {
    domain:
      entries.find((e) => e.envKey === "DOMAIN")?.value ??
      `svc-${service.id.slice(-8)}.example.com`,
  };
}

export const interworxServer: ServerDriver = {
  slug: "interworx",
  name: "InterWorx",
  configFields: [
    { key: "host", label: "NodeWorx URL", type: "text", required: true, help: "e.g. https://server.example.com:2443" },
    { key: "api_key", label: "API key", type: "password", required: true },
  ],
  productConfigFields: [
    { key: "plan", label: "SiteWorx package/plan", type: "text", required: true },
    { key: "ip", label: "IP address", type: "text", required: true },
  ],
  async create(service, config, productConfig) {
    const { domain } = accountFor(service);
    await iworx(config, "/nodeworx/siteworx", "add", {
      domain,
      nickname: `oh${service.id.slice(-6)}`,
      uniqname: `oh${service.id.slice(-6)}`,
      email: service.user.email,
      password: randomBytes(12).toString("base64url"),
      packagetemplate: productConfig.plan,
      ipv4: productConfig.ip,
    });
    return domain;
  },
  async suspend(service, config) {
    if (!service.externalId) return;
    await iworx(config, "/nodeworx/siteworx", "suspend", { domain: service.externalId });
  },
  async unsuspend(service, config) {
    if (!service.externalId) return;
    await iworx(config, "/nodeworx/siteworx", "unsuspend", { domain: service.externalId });
  },
  async terminate(service, config) {
    if (!service.externalId) return;
    await iworx(config, "/nodeworx/siteworx", "delete", { domain: service.externalId });
  },
};
