import type { ServerDriver } from "@/lib/extensions/types";
import { randomBytes } from "node:crypto";

// Convoy (convoypanel.com) application API — Pterodactyl-style Bearer auth.
async function convoy(
  config: Record<string, string>,
  method: string,
  path: string,
  body?: unknown,
) {
  const base = config.panel_url?.replace(/\/$/, "");
  const res = await fetch(`${base}/api/application${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.api_key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`Convoy API ${method} ${path} failed: ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

async function findOrCreateUser(
  config: Record<string, string>,
  email: string,
  name: string,
): Promise<number> {
  const search = await convoy(
    config,
    "GET",
    `/users?filter[email]=${encodeURIComponent(email)}`,
  );
  if (search?.data?.length) return search.data[0].id as number;
  const created = await convoy(config, "POST", "/users", {
    name,
    email,
    password: randomBytes(16).toString("base64url"),
    root_admin: false,
  });
  return (created.data?.id ?? created.id) as number;
}

const MB = 1024 * 1024;

export const convoyServer: ServerDriver = {
  slug: "convoy",
  name: "Convoy",
  configFields: [
    { key: "panel_url", label: "Panel URL", type: "text", required: true },
    { key: "api_key", label: "Application API key", type: "password", required: true },
  ],
  productConfigFields: [
    { key: "node_id", label: "Node ID", type: "text", required: true },
    { key: "template_uuid", label: "Template UUID", type: "text", required: true },
    { key: "cpu", label: "vCPU cores", type: "text", required: true },
    { key: "memory", label: "Memory (MB)", type: "text", required: true },
    { key: "disk", label: "Disk (MB)", type: "text", required: true },
    { key: "bandwidth", label: "Bandwidth (MB, blank = unlimited)", type: "text" },
    { key: "snapshots", label: "Snapshot limit", type: "text" },
    { key: "backups", label: "Backup limit", type: "text" },
  ],
  async create(service, config, productConfig) {
    const userId = await findOrCreateUser(
      config,
      service.user.email,
      `${service.user.firstName} ${service.user.lastName}`,
    );
    const server = await convoy(config, "POST", "/servers", {
      node_id: Number(productConfig.node_id),
      user_id: userId,
      name: `service-${service.id.slice(-8)}`,
      hostname: `service-${service.id.slice(-8)}`,
      vmid: null,
      limits: {
        cpu: Number(productConfig.cpu),
        memory: Number(productConfig.memory) * MB,
        disk: Number(productConfig.disk) * MB,
        snapshots: Number(productConfig.snapshots ?? 0),
        backups: productConfig.backups ? Number(productConfig.backups) : null,
        bandwidth: productConfig.bandwidth
          ? Number(productConfig.bandwidth) * MB
          : null,
        address_ids: [],
      },
      account_password: randomBytes(12).toString("base64url"),
      should_create_server: true,
      template_uuid: productConfig.template_uuid,
      start_on_completion: true,
    });
    return String(server.data?.uuid ?? server.uuid ?? server.data?.id);
  },
  async suspend(service, config) {
    if (!service.externalId) return;
    await convoy(config, "POST", `/servers/${service.externalId}/settings/suspend`);
  },
  async unsuspend(service, config) {
    if (!service.externalId) return;
    await convoy(config, "POST", `/servers/${service.externalId}/settings/unsuspend`);
  },
  async terminate(service, config) {
    if (!service.externalId) return;
    await convoy(config, "DELETE", `/servers/${service.externalId}`);
  },
};
