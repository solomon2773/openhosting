import type { ServerDriver } from "@/lib/extensions/types";
import { randomBytes } from "node:crypto";

// VirtFusion REST API v1 (Bearer token). Users are linked via
// extRelationId, which we point at a stable hash of the customer's id.
async function vf(
  config: Record<string, string>,
  method: string,
  path: string,
  body?: unknown,
) {
  const base = config.panel_url?.replace(/\/$/, "");
  const res = await fetch(`${base}/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.api_token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`VirtFusion API ${method} ${path} failed: ${res.status}`);
  }
  if (res.status === 404) return null;
  return res.status === 204 ? null : res.json();
}

// VirtFusion wants a numeric external relation id.
function extRelationId(userId: string): number {
  let hash = 0;
  for (const char of userId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % 2_000_000_000;
}

async function findOrCreateUser(
  config: Record<string, string>,
  user: { id: string; email: string; firstName: string; lastName: string },
): Promise<number> {
  const relationId = extRelationId(user.id);
  const existing = await vf(config, "GET", `/users/${relationId}/byExtRelation`);
  if (existing?.data?.id) return existing.data.id as number;
  const created = await vf(config, "POST", "/users", {
    name: `${user.firstName} ${user.lastName}`,
    email: user.email,
    extRelationId: relationId,
    password: randomBytes(16).toString("base64url"),
    sendMail: true,
  });
  return created.data.id as number;
}

export const virtFusionServer: ServerDriver = {
  slug: "virtfusion",
  name: "VirtFusion",
  configFields: [
    { key: "panel_url", label: "Panel URL", type: "text", required: true },
    { key: "api_token", label: "API token", type: "password", required: true },
  ],
  productConfigFields: [
    { key: "package_id", label: "Package ID", type: "text", required: true },
    { key: "hypervisor_group_id", label: "Hypervisor group ID", type: "text", required: true },
    { key: "os_template_id", label: "OS template ID", type: "text", required: true },
    { key: "ipv4", label: "IPv4 addresses", type: "text", help: "Number of IPv4 addresses (default 1)" },
  ],
  async create(service, config, productConfig) {
    const userId = await findOrCreateUser(config, service.user);
    const server = await vf(config, "POST", "/servers", {
      packageId: Number(productConfig.package_id),
      userId,
      hypervisorId: Number(productConfig.hypervisor_group_id),
      ipv4: Number(productConfig.ipv4 ?? 1),
    });
    const serverId = server.data.id as number;
    await vf(config, "POST", `/servers/${serverId}/build`, {
      operatingSystemId: Number(productConfig.os_template_id),
      name: `service-${service.id.slice(-8)}`,
      hostname: `service-${service.id.slice(-8)}.host`,
      email: true,
    });
    return String(serverId);
  },
  async suspend(service, config) {
    if (!service.externalId) return;
    await vf(config, "POST", `/servers/${service.externalId}/suspend`);
  },
  async unsuspend(service, config) {
    if (!service.externalId) return;
    await vf(config, "POST", `/servers/${service.externalId}/unsuspend`);
  },
  async terminate(service, config) {
    if (!service.externalId) return;
    await vf(config, "DELETE", `/servers/${service.externalId}?delay=0`);
  },
};
