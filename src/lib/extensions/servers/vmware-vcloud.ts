import type { ServerDriver } from "@/lib/extensions/types";
import type { Service } from "@/generated/prisma/client";

// VMware vCloud Director (Cloud Director) API. Bearer-token auth via the
// sessions endpoint; vApps are instantiated from a template into a vDC.
// Suspend/unsuspend/terminate use the vApp power/undeploy/delete actions.
async function vcdLogin(config: Record<string, string>): Promise<{
  base: string;
  token: string;
}> {
  const base = config.host.replace(/\/$/, "");
  const res = await fetch(`${base}/api/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.username}@${config.org}:${config.password}`).toString("base64")}`,
      Accept: "application/*+json;version=37.0",
    },
  });
  if (!res.ok) throw new Error(`vCloud auth failed: ${res.status}`);
  const token = res.headers.get("x-vmware-vcloud-access-token") ??
    res.headers.get("x-vcloud-authorization") ?? "";
  return { base, token };
}

async function vcd(
  session: { base: string; token: string },
  method: string,
  path: string,
  body?: unknown,
) {
  const res = await fetch(`${session.base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${session.token}`,
      Accept: "application/*+json;version=37.0",
      ...(body ? { "Content-Type": "application/*+json;version=37.0" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`vCloud ${method} ${path} failed: ${res.status}`);
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

export const vmwareVcloudServer: ServerDriver = {
  slug: "vmware-vcloud",
  name: "VMware vCloud Director",
  configFields: [
    { key: "host", label: "vCloud URL", type: "text", required: true, help: "e.g. https://vcd.example.com" },
    { key: "org", label: "Organization", type: "text", required: true },
    { key: "username", label: "Username", type: "text", required: true },
    { key: "password", label: "Password", type: "password", required: true },
  ],
  productConfigFields: [
    { key: "vdc_id", label: "Virtual Data Center ID", type: "text", required: true },
    { key: "template_id", label: "vApp template ID", type: "text", required: true },
    { key: "network_name", label: "Org VDC network name", type: "text", required: true },
  ],
  async create(service, config, productConfig) {
    const session = await vcdLogin(config);
    overrides(service); // reserved for future CPU/RAM recustomization
    const result = await vcd(
      session,
      "POST",
      `/api/vdc/${productConfig.vdc_id}/action/instantiateVAppTemplate`,
      {
        name: `svc-${service.id.slice(-8)}`,
        source: { href: `${session.base}/api/vAppTemplate/${productConfig.template_id}` },
        deploy: true,
        powerOn: true,
        instantiationParams: {
          networkConfigSection: {
            networkConfig: [{ networkName: productConfig.network_name }],
          },
        },
      },
    );
    // response id is like "urn:vcloud:vapp:<uuid>"
    return String(result?.id ?? result?.href ?? `svc-${service.id.slice(-8)}`);
  },
  async suspend(service, config) {
    if (!service.externalId) return;
    const session = await vcdLogin(config);
    const id = service.externalId.split(":").pop();
    await vcd(session, "POST", `/api/vApp/vapp-${id}/power/action/powerOff`);
  },
  async unsuspend(service, config) {
    if (!service.externalId) return;
    const session = await vcdLogin(config);
    const id = service.externalId.split(":").pop();
    await vcd(session, "POST", `/api/vApp/vapp-${id}/power/action/powerOn`);
  },
  async terminate(service, config) {
    if (!service.externalId) return;
    const session = await vcdLogin(config);
    const id = service.externalId.split(":").pop();
    // must be powered off / undeployed before delete
    await vcd(session, "POST", `/api/vApp/vapp-${id}/action/undeploy`, {
      UndeployPowerAction: "powerOff",
    }).catch(() => undefined);
    await vcd(session, "DELETE", `/api/vApp/vapp-${id}`);
  },
};
