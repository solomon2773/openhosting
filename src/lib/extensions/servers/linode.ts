import type { ServerDriver } from "@/lib/extensions/types";
import type { Service } from "@/generated/prisma/client";
import { randomBytes } from "node:crypto";

// Linode (Akamai) API v4 (Bearer token). Linodes; suspend = shutdown.
async function linode(
  config: Record<string, string>,
  method: string,
  path: string,
  body?: unknown,
) {
  const res = await fetch(`https://api.linode.com/v4${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.api_token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Linode ${method} ${path} failed: ${res.status}`);
  }
  return res.status === 404 ? null : res.json().catch(() => null);
}

function overrides(service: Service): Record<string, string> {
  const entries =
    (service.config as Array<{ envKey?: string; value: string }> | null) ?? [];
  return Object.fromEntries(
    entries.filter((e) => e.envKey).map((e) => [e.envKey as string, e.value]),
  );
}

export const linodeServer: ServerDriver = {
  slug: "linode",
  name: "Linode",
  configFields: [
    { key: "api_token", label: "API token", type: "password", required: true },
  ],
  productConfigFields: [
    { key: "type", label: "Instance type", type: "text", required: true, help: "e.g. g6-nanode-1" },
    { key: "image", label: "Image", type: "text", required: true, help: "e.g. linode/debian12" },
    { key: "region", label: "Region", type: "text", required: true, help: "e.g. us-east" },
  ],
  async create(service, config, productConfig) {
    const custom = overrides(service);
    const result = await linode(config, "POST", "/linode/instances", {
      label: `svc-${service.id.slice(-8)}`,
      region: productConfig.region,
      type: custom.TYPE ?? productConfig.type,
      image: productConfig.image,
      root_pass: randomBytes(16).toString("base64url") + "Aa1!",
      booted: true,
    });
    return String(result.id);
  },
  async suspend(service, config) {
    if (!service.externalId) return;
    await linode(config, "POST", `/linode/instances/${service.externalId}/shutdown`);
  },
  async unsuspend(service, config) {
    if (!service.externalId) return;
    await linode(config, "POST", `/linode/instances/${service.externalId}/boot`);
  },
  async terminate(service, config) {
    if (!service.externalId) return;
    await linode(config, "DELETE", `/linode/instances/${service.externalId}`);
  },
};
