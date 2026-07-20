import type { ServerDriver } from "@/lib/extensions/types";
import type { Service } from "@/generated/prisma/client";

// SolusVM 1 admin API (key/hash auth, form-encoded, XML or JSON response).
async function solus(
  config: Record<string, string>,
  params: Record<string, string>,
) {
  const base = config.host?.replace(/\/$/, "");
  const body = new URLSearchParams({
    key: config.api_key,
    hash: config.api_hash,
    rdtype: "json",
    ...params,
  });
  const res = await fetch(`${base}/api/admin/command.php`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`SolusVM ${params.action} failed: ${res.status}`);
  const data = await res.json().catch(() => ({ status: "error" }));
  if (data.status !== "success") {
    throw new Error(`SolusVM ${params.action} failed: ${data.statusmsg ?? "unknown"}`);
  }
  return data;
}

function overrides(service: Service): Record<string, string> {
  const entries =
    (service.config as Array<{ envKey?: string; value: string }> | null) ?? [];
  return Object.fromEntries(
    entries.filter((e) => e.envKey).map((e) => [e.envKey as string, e.value]),
  );
}

export const solusvmServer: ServerDriver = {
  slug: "solusvm",
  name: "SolusVM",
  configFields: [
    { key: "host", label: "Master URL", type: "text", required: true, help: "e.g. https://master.example.com:5656" },
    { key: "api_key", label: "API key", type: "password", required: true },
    { key: "api_hash", label: "API hash", type: "password", required: true },
  ],
  productConfigFields: [
    { key: "type", label: "Virtualization type", type: "select", required: true, options: [
      { label: "KVM", value: "kvm" },
      { label: "OpenVZ", value: "openvz" },
      { label: "Xen", value: "xen" },
    ] },
    { key: "nodegroup", label: "Node group ID", type: "text", required: true },
    { key: "plan", label: "Plan name", type: "text", required: true },
    { key: "template", label: "Template", type: "text", required: true },
    { key: "ips", label: "IPv4 count", type: "text" },
  ],
  async create(service, config, productConfig) {
    const custom = overrides(service);
    const result = await solus(config, {
      action: "vserver-create",
      type: productConfig.type,
      nodegroup: productConfig.nodegroup,
      plan: productConfig.plan,
      template: productConfig.template,
      hostname: `svc-${service.id.slice(-8)}.host`,
      username: `oh${service.id.slice(-6)}`,
      password: Math.random().toString(36).slice(2, 14),
      email: service.user.email,
      ips: custom.IPS ?? productConfig.ips ?? "1",
    });
    return String(result.vserverid);
  },
  async suspend(service, config) {
    if (!service.externalId) return;
    await solus(config, { action: "vserver-suspend", vserverid: service.externalId });
  },
  async unsuspend(service, config) {
    if (!service.externalId) return;
    await solus(config, { action: "vserver-unsuspend", vserverid: service.externalId });
  },
  async terminate(service, config) {
    if (!service.externalId) return;
    await solus(config, { action: "vserver-terminate", vserverid: service.externalId, deleteclient: "false" });
  },
};
