import type { ServerDriver } from "@/lib/extensions/types";
import type { Service } from "@/generated/prisma/client";

// Vultr API v2 (Bearer token). Instances; suspend = halt.
async function vultr(
  config: Record<string, string>,
  method: string,
  path: string,
  body?: unknown,
) {
  const res = await fetch(`https://api.vultr.com/v2${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.api_key}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Vultr ${method} ${path} failed: ${res.status}`);
  }
  return res.status === 204 || res.status === 404 ? null : res.json();
}

function overrides(service: Service): Record<string, string> {
  const entries =
    (service.config as Array<{ envKey?: string; value: string }> | null) ?? [];
  return Object.fromEntries(
    entries.filter((e) => e.envKey).map((e) => [e.envKey as string, e.value]),
  );
}

export const vultrServer: ServerDriver = {
  slug: "vultr",
  name: "Vultr",
  configFields: [
    { key: "api_key", label: "API key", type: "password", required: true },
  ],
  productConfigFields: [
    { key: "plan", label: "Plan", type: "text", required: true, help: "e.g. vc2-1c-1gb" },
    { key: "os_id", label: "OS ID", type: "text", required: true, help: "e.g. 2136 (Debian 12)" },
    { key: "region", label: "Region", type: "text", required: true, help: "e.g. ewr" },
  ],
  async create(service, config, productConfig) {
    const custom = overrides(service);
    const result = await vultr(config, "POST", "/instances", {
      region: productConfig.region,
      plan: custom.PLAN ?? productConfig.plan,
      os_id: Number(productConfig.os_id),
      label: `svc-${service.id.slice(-8)}`,
      hostname: `svc-${service.id.slice(-8)}`,
    });
    return String(result.instance.id);
  },
  async suspend(service, config) {
    if (!service.externalId) return;
    await vultr(config, "POST", `/instances/${service.externalId}/halt`);
  },
  async unsuspend(service, config) {
    if (!service.externalId) return;
    await vultr(config, "POST", `/instances/${service.externalId}/start`);
  },
  async terminate(service, config) {
    if (!service.externalId) return;
    await vultr(config, "DELETE", `/instances/${service.externalId}`);
  },
};
