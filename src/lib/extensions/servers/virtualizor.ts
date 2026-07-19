import type { ServerDriver } from "@/lib/extensions/types";
import { randomBytes } from "node:crypto";

// Virtualizor admin API (key/pass auth, JSON responses).
async function virtualizor(
  config: Record<string, string>,
  act: string,
  params: Record<string, string> = {},
  post = false,
) {
  const base = config.panel_url?.replace(/\/$/, "");
  const query = new URLSearchParams({
    act,
    api: "json",
    adminapikey: config.api_key,
    adminapipass: config.api_pass,
    ...(post ? {} : params),
  });
  const url = `${base}/index.php?${query}`;
  const res = await fetch(url, {
    method: post ? "POST" : "GET",
    headers: post
      ? { "Content-Type": "application/x-www-form-urlencoded" }
      : undefined,
    body: post ? new URLSearchParams(params) : undefined,
  });
  if (!res.ok) throw new Error(`Virtualizor ${act} failed: HTTP ${res.status}`);
  const data = await res.json();
  if (data?.error && Object.keys(data.error).length) {
    throw new Error(`Virtualizor ${act} failed: ${JSON.stringify(data.error)}`);
  }
  return data;
}

export const virtualizorServer: ServerDriver = {
  slug: "virtualizor",
  name: "Virtualizor",
  configFields: [
    { key: "panel_url", label: "Panel URL", type: "text", required: true, help: "e.g. https://host.example.com:4085" },
    { key: "api_key", label: "Admin API key", type: "password", required: true },
    { key: "api_pass", label: "Admin API pass", type: "password", required: true },
  ],
  productConfigFields: [
    {
      key: "virt",
      label: "Virtualization type",
      type: "select",
      required: true,
      options: [
        { label: "KVM", value: "kvm" },
        { label: "OpenVZ", value: "openvz" },
        { label: "Xen", value: "xen" },
        { label: "LXC", value: "lxc" },
      ],
    },
    { key: "server_id", label: "Node/server ID", type: "text", required: true },
    { key: "plan_id", label: "Plan ID", type: "text", required: true },
    { key: "os_id", label: "OS template ID", type: "text", required: true },
    { key: "num_ips", label: "IPv4 count", type: "text" },
  ],
  async create(service, config, productConfig) {
    const result = await virtualizor(
      config,
      "addvs",
      {
        virt: productConfig.virt,
        serid: productConfig.server_id,
        plid: productConfig.plan_id,
        osid: productConfig.os_id,
        hostname: `service-${service.id.slice(-8)}.host`,
        user_email: service.user.email,
        user_pass: randomBytes(12).toString("base64url"),
        rootpass: randomBytes(12).toString("base64url"),
        num_ips: productConfig.num_ips ?? "1",
        addvps: "1",
      },
      true,
    );
    const vpsId = result?.vs_info?.vpsid ?? result?.vpsid;
    if (!vpsId) throw new Error("Virtualizor did not return a VPS id");
    return String(vpsId);
  },
  async suspend(service, config) {
    if (!service.externalId) return;
    await virtualizor(config, "vs", { suspend: service.externalId });
  },
  async unsuspend(service, config) {
    if (!service.externalId) return;
    await virtualizor(config, "vs", { unsuspend: service.externalId });
  },
  async terminate(service, config) {
    if (!service.externalId) return;
    await virtualizor(config, "vs", { delete: service.externalId });
  },
};
