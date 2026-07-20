import type { ServerDriver } from "@/lib/extensions/types";
import type { Service } from "@/generated/prisma/client";

// OnApp cloud API (basic auth with email + API key). Virtual servers;
// suspend maps to lock/stop, unsuspend to unlock/start.
async function onapp(
  config: Record<string, string>,
  method: string,
  path: string,
  body?: unknown,
) {
  const base = config.host?.replace(/\/$/, "");
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.email}:${config.api_key}`).toString("base64")}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`OnApp ${method} ${path} failed: ${res.status}`);
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

export const onAppServer: ServerDriver = {
  slug: "onapp",
  name: "OnApp",
  configFields: [
    { key: "host", label: "Control panel URL", type: "text", required: true },
    { key: "email", label: "API user email", type: "text", required: true },
    { key: "api_key", label: "API key", type: "password", required: true },
  ],
  productConfigFields: [
    { key: "template_id", label: "Template ID", type: "text", required: true },
    { key: "hypervisor_group_id", label: "Hypervisor group ID", type: "text", required: true },
    { key: "cpus", label: "CPU cores", type: "text", required: true },
    { key: "memory", label: "Memory (MB)", type: "text", required: true },
    { key: "disk", label: "Primary disk (GB)", type: "text", required: true },
  ],
  async create(service, config, productConfig) {
    const custom = overrides(service);
    const result = await onapp(config, "POST", "/virtual_machines.json", {
      virtual_machine: {
        label: `svc-${service.id.slice(-8)}`,
        hostname: `svc-${service.id.slice(-8)}`,
        template_id: Number(productConfig.template_id),
        hypervisor_group_id: Number(productConfig.hypervisor_group_id),
        cpus: Number(custom.CPUS ?? productConfig.cpus),
        memory: Number(custom.MEMORY ?? productConfig.memory),
        primary_disk_size: Number(custom.DISK ?? productConfig.disk),
        rate_limit: 0,
        required_virtual_machine_build: 1,
        required_ip_address_assignment: 1,
      },
    });
    return String(result.virtual_machine.identifier);
  },
  async suspend(service, config) {
    if (!service.externalId) return;
    await onapp(config, "POST", `/virtual_machines/${service.externalId}/stop.json`);
    await onapp(config, "POST", `/virtual_machines/${service.externalId}/lock.json`).catch(() => undefined);
  },
  async unsuspend(service, config) {
    if (!service.externalId) return;
    await onapp(config, "POST", `/virtual_machines/${service.externalId}/unlock.json`).catch(() => undefined);
    await onapp(config, "POST", `/virtual_machines/${service.externalId}/startup.json`);
  },
  async terminate(service, config) {
    if (!service.externalId) return;
    await onapp(config, "DELETE", `/virtual_machines/${service.externalId}.json?destroy_all_backups=1`);
  },
};
