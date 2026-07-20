import type { ServerDriver } from "@/lib/extensions/types";
import type { Service } from "@/generated/prisma/client";

// DigitalOcean API (Bearer token). Droplets; suspend = power off.
async function ocean(
  config: Record<string, string>,
  method: string,
  path: string,
  body?: unknown,
) {
  const res = await fetch(`https://api.digitalocean.com/v2${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.api_token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`DigitalOcean ${method} ${path} failed: ${res.status}`);
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

export const digitalOceanServer: ServerDriver = {
  slug: "digitalocean",
  name: "DigitalOcean",
  configFields: [
    { key: "api_token", label: "API token", type: "password", required: true },
  ],
  productConfigFields: [
    { key: "size", label: "Droplet size", type: "text", required: true, help: "e.g. s-1vcpu-1gb" },
    { key: "image", label: "Image", type: "text", required: true, help: "e.g. debian-12-x64" },
    { key: "region", label: "Region", type: "text", required: true, help: "e.g. nyc3" },
  ],
  async create(service, config, productConfig) {
    const custom = overrides(service);
    const result = await ocean(config, "POST", "/droplets", {
      name: `svc-${service.id.slice(-8)}`,
      region: productConfig.region,
      size: custom.SIZE ?? productConfig.size,
      image: productConfig.image,
    });
    return String(result.droplet.id);
  },
  async suspend(service, config) {
    if (!service.externalId) return;
    await ocean(config, "POST", `/droplets/${service.externalId}/actions`, {
      type: "power_off",
    });
  },
  async unsuspend(service, config) {
    if (!service.externalId) return;
    await ocean(config, "POST", `/droplets/${service.externalId}/actions`, {
      type: "power_on",
    });
  },
  async terminate(service, config) {
    if (!service.externalId) return;
    await ocean(config, "DELETE", `/droplets/${service.externalId}`);
  },
};
