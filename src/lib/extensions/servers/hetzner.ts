import type { ServerDriver } from "@/lib/extensions/types";
import type { Service } from "@/generated/prisma/client";

// Hetzner Cloud API (Bearer token). Suspend = power off, terminate = delete.
async function hetzner(
  config: Record<string, string>,
  method: string,
  path: string,
  body?: unknown,
) {
  const res = await fetch(`https://api.hetzner.cloud/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.api_token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Hetzner ${method} ${path} failed: ${res.status}`);
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

export const hetznerServer: ServerDriver = {
  slug: "hetzner",
  name: "Hetzner Cloud",
  configFields: [
    { key: "api_token", label: "API token", type: "password", required: true },
  ],
  productConfigFields: [
    { key: "server_type", label: "Server type", type: "text", required: true, help: "e.g. cx22" },
    { key: "image", label: "Image", type: "text", required: true, help: "e.g. debian-12" },
    { key: "location", label: "Location", type: "text", help: "e.g. nbg1" },
  ],
  async create(service, config, productConfig) {
    const custom = overrides(service);
    const result = await hetzner(config, "POST", "/servers", {
      name: `svc-${service.id.slice(-8)}`,
      server_type: custom.SERVER_TYPE ?? productConfig.server_type,
      image: productConfig.image,
      location: productConfig.location || undefined,
      start_after_create: true,
    });
    return String(result.server.id);
  },
  async suspend(service, config) {
    if (!service.externalId) return;
    await hetzner(config, "POST", `/servers/${service.externalId}/actions/poweroff`);
  },
  async unsuspend(service, config) {
    if (!service.externalId) return;
    await hetzner(config, "POST", `/servers/${service.externalId}/actions/poweron`);
  },
  async terminate(service, config) {
    if (!service.externalId) return;
    await hetzner(config, "DELETE", `/servers/${service.externalId}`);
  },
};
