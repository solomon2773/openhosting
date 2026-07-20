import type { ServerDriver } from "@/lib/extensions/types";
import type { Service } from "@/generated/prisma/client";

// OpenStack (Keystone auth + Nova compute). Password auth against Keystone v3
// yields a scoped token used for Nova calls. Suspend/unsuspend map to Nova's
// os-suspend/os-resume server actions.
async function keystoneToken(
  config: Record<string, string>,
): Promise<{ token: string; nova: string }> {
  const res = await fetch(`${config.auth_url.replace(/\/$/, "")}/auth/tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      auth: {
        identity: {
          methods: ["password"],
          password: {
            user: {
              name: config.username,
              domain: { name: config.user_domain || "Default" },
              password: config.password,
            },
          },
        },
        scope: {
          project: {
            name: config.project_name,
            domain: { name: config.project_domain || "Default" },
          },
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`OpenStack auth failed: ${res.status}`);
  const token = res.headers.get("x-subject-token") ?? "";
  const body = await res.json();
  const nova = (body.token.catalog as Array<{ type: string; endpoints: Array<{ interface: string; url: string; region: string }> }>)
    .find((s) => s.type === "compute")
    ?.endpoints.find((e) => e.interface === "public" && (!config.region || e.region === config.region))?.url;
  if (!nova) throw new Error("OpenStack: no public compute endpoint found");
  return { token, nova };
}

async function nova(
  auth: { token: string; nova: string },
  method: string,
  path: string,
  body?: unknown,
) {
  const res = await fetch(`${auth.nova}${path}`, {
    method,
    headers: {
      "X-Auth-Token": auth.token,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`OpenStack Nova ${method} ${path} failed: ${res.status}`);
  }
  return res.status === 202 || res.status === 204 || res.status === 404
    ? null
    : res.json();
}

function overrides(service: Service): Record<string, string> {
  const entries =
    (service.config as Array<{ envKey?: string; value: string }> | null) ?? [];
  return Object.fromEntries(
    entries.filter((e) => e.envKey).map((e) => [e.envKey as string, e.value]),
  );
}

export const openStackServer: ServerDriver = {
  slug: "openstack",
  name: "OpenStack",
  configFields: [
    { key: "auth_url", label: "Keystone auth URL", type: "text", required: true, help: "e.g. https://keystone.example.com:5000/v3" },
    { key: "username", label: "Username", type: "text", required: true },
    { key: "password", label: "Password", type: "password", required: true },
    { key: "project_name", label: "Project name", type: "text", required: true },
    { key: "user_domain", label: "User domain", type: "text", help: "Default" },
    { key: "project_domain", label: "Project domain", type: "text", help: "Default" },
    { key: "region", label: "Region", type: "text" },
  ],
  productConfigFields: [
    { key: "flavor_id", label: "Flavor ID", type: "text", required: true },
    { key: "image_id", label: "Image ID", type: "text", required: true },
    { key: "network_id", label: "Network ID", type: "text", required: true },
  ],
  async create(service, config, productConfig) {
    const auth = await keystoneToken(config);
    const custom = overrides(service);
    const result = await nova(auth, "POST", "/servers", {
      server: {
        name: `svc-${service.id.slice(-8)}`,
        flavorRef: custom.FLAVOR ?? productConfig.flavor_id,
        imageRef: productConfig.image_id,
        networks: [{ uuid: productConfig.network_id }],
      },
    });
    return String(result.server.id);
  },
  async suspend(service, config) {
    if (!service.externalId) return;
    const auth = await keystoneToken(config);
    await nova(auth, "POST", `/servers/${service.externalId}/action`, { suspend: null });
  },
  async unsuspend(service, config) {
    if (!service.externalId) return;
    const auth = await keystoneToken(config);
    await nova(auth, "POST", `/servers/${service.externalId}/action`, { resume: null });
  },
  async terminate(service, config) {
    if (!service.externalId) return;
    const auth = await keystoneToken(config);
    await nova(auth, "DELETE", `/servers/${service.externalId}`);
  },
};
