import type { ServerDriver } from "@/lib/extensions/types";
import type { Service } from "@prisma/client";

async function ptero(
  config: Record<string, string>,
  method: string,
  path: string,
  body?: unknown,
) {
  const res = await fetch(`${config.panel_url?.replace(/\/$/, "")}/api/application${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.api_key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`Pterodactyl API ${method} ${path} failed: ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

async function findOrCreatePteroUser(
  config: Record<string, string>,
  email: string,
  firstName: string,
  lastName: string,
): Promise<number> {
  const search = await ptero(
    config,
    "GET",
    `/users?filter[email]=${encodeURIComponent(email)}`,
  );
  if (search?.data?.length) return search.data[0].attributes.id as number;
  const created = await ptero(config, "POST", "/users", {
    email,
    username: email.split("@")[0].replace(/[^a-z0-9]/gi, "").toLowerCase() ||
      `user${Date.now()}`,
    first_name: firstName,
    last_name: lastName,
  });
  return created.attributes.id as number;
}

function svcConfig(service: Service): Record<string, string> {
  const entries = (service.config as Array<{ option?: string; envKey?: string; value: string }> | null) ?? [];
  return Object.fromEntries(
    entries.filter((e) => e.envKey).map((e) => [e.envKey as string, e.value]),
  );
}

export const pterodactylServer: ServerDriver = {
  slug: "pterodactyl",
  name: "Pterodactyl",
  configFields: [
    { key: "panel_url", label: "Panel URL", type: "text", required: true, help: "e.g. https://panel.example.com" },
    { key: "api_key", label: "Application API key", type: "password", required: true },
  ],
  productConfigFields: [
    { key: "egg_id", label: "Egg ID", type: "text", required: true },
    { key: "nest_id", label: "Nest ID", type: "text", required: true },
    { key: "location_id", label: "Location ID", type: "text", required: true },
    { key: "memory", label: "Memory (MB)", type: "text", required: true },
    { key: "disk", label: "Disk (MB)", type: "text", required: true },
    { key: "cpu", label: "CPU (%)", type: "text", required: true },
    { key: "databases", label: "Databases", type: "text" },
    { key: "backups", label: "Backups", type: "text" },
  ],
  async create(service, config, productConfig) {
    const pteroUserId = await findOrCreatePteroUser(
      config,
      service.user.email,
      service.user.firstName,
      service.user.lastName,
    );
    const egg = await ptero(
      config,
      "GET",
      `/nests/${productConfig.nest_id}/eggs/${productConfig.egg_id}?include=variables`,
    );
    const overrides = svcConfig(service);
    const environment: Record<string, string> = {};
    for (const variable of egg.attributes.relationships.variables.data) {
      const key = variable.attributes.env_variable as string;
      environment[key] = overrides[key] ?? variable.attributes.default_value ?? "";
    }
    const server = await ptero(config, "POST", "/servers", {
      name: `service-${service.id.slice(-8)}`,
      user: pteroUserId,
      egg: Number(productConfig.egg_id),
      docker_image: egg.attributes.docker_image,
      startup: egg.attributes.startup,
      environment,
      limits: {
        memory: Number(overrides.memory ?? productConfig.memory),
        swap: 0,
        disk: Number(overrides.disk ?? productConfig.disk),
        io: 500,
        cpu: Number(overrides.cpu ?? productConfig.cpu),
      },
      feature_limits: {
        databases: Number(productConfig.databases ?? 0),
        backups: Number(productConfig.backups ?? 0),
        allocations: 1,
      },
      deploy: {
        locations: [Number(productConfig.location_id)],
        dedicated_ip: false,
        port_range: [],
      },
    });
    return String(server.attributes.id);
  },
  async suspend(service, config) {
    if (!service.externalId) return;
    await ptero(config, "POST", `/servers/${service.externalId}/suspend`);
  },
  async unsuspend(service, config) {
    if (!service.externalId) return;
    await ptero(config, "POST", `/servers/${service.externalId}/unsuspend`);
  },
  async terminate(service, config) {
    if (!service.externalId) return;
    await ptero(config, "DELETE", `/servers/${service.externalId}`);
  },
};
