import type { ServerDriver } from "@/lib/extensions/types";
import type { Service } from "@/generated/prisma/client";

// Virtuozzo Hybrid Infrastructure — OpenStack-compatible compute API behind
// its own Keystone. Token auth then Nova-style server actions.
async function vzToken(config: Record<string, string>) {
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
              domain: { name: config.domain || "Default" },
              password: config.password,
            },
          },
        },
        scope: {
          project: {
            name: config.project_name,
            domain: { name: config.domain || "Default" },
          },
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`Virtuozzo auth failed: ${res.status}`);
  const token = res.headers.get("x-subject-token") ?? "";
  const body = await res.json();
  const compute = (body.token.catalog as Array<{ type: string; endpoints: Array<{ interface: string; url: string }> }>)
    .find((s) => s.type === "compute")
    ?.endpoints.find((e) => e.interface === "public")?.url;
  if (!compute) throw new Error("Virtuozzo: no compute endpoint");
  return { token, compute };
}

async function vzNova(
  auth: { token: string; compute: string },
  method: string,
  path: string,
  body?: unknown,
) {
  const res = await fetch(`${auth.compute}${path}`, {
    method,
    headers: { "X-Auth-Token": auth.token, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Virtuozzo compute ${method} ${path} failed: ${res.status}`);
  }
  return res.status === 202 || res.status === 204 || res.status === 404 ? null : res.json();
}

function overrides(service: Service): Record<string, string> {
  const entries =
    (service.config as Array<{ envKey?: string; value: string }> | null) ?? [];
  return Object.fromEntries(
    entries.filter((e) => e.envKey).map((e) => [e.envKey as string, e.value]),
  );
}

export const virtuozzoServer: ServerDriver = {
  slug: "virtuozzo",
  name: "Virtuozzo",
  configFields: [
    { key: "auth_url", label: "Keystone auth URL", type: "text", required: true, help: "e.g. https://vhi.example.com:5000/v3" },
    { key: "username", label: "Username", type: "text", required: true },
    { key: "password", label: "Password", type: "password", required: true },
    { key: "project_name", label: "Project name", type: "text", required: true },
    { key: "domain", label: "Domain", type: "text", help: "Default" },
  ],
  productConfigFields: [
    { key: "flavor_id", label: "Flavor ID", type: "text", required: true },
    { key: "image_id", label: "Image ID", type: "text", required: true },
    { key: "network_id", label: "Network ID", type: "text", required: true },
  ],
  async create(service, config, productConfig) {
    const auth = await vzToken(config);
    const custom = overrides(service);
    const result = await vzNova(auth, "POST", "/servers", {
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
    const auth = await vzToken(config);
    await vzNova(auth, "POST", `/servers/${service.externalId}/action`, { suspend: null });
  },
  async unsuspend(service, config) {
    if (!service.externalId) return;
    const auth = await vzToken(config);
    await vzNova(auth, "POST", `/servers/${service.externalId}/action`, { resume: null });
  },
  async terminate(service, config) {
    if (!service.externalId) return;
    const auth = await vzToken(config);
    await vzNova(auth, "DELETE", `/servers/${service.externalId}`);
  },
};
