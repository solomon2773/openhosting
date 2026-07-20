import type { ServerDriver } from "@/lib/extensions/types";
import type { Service } from "@/generated/prisma/client";
import { randomBytes } from "node:crypto";

// ISPConfig 3 remote JSON API (/remote/json.php). Login → call → logout;
// each lifecycle method opens its own short session.
async function ispCall(
  config: Record<string, string>,
  method: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  const base = config.host?.replace(/\/$/, "");
  const url = `${base}/remote/json.php`;
  const call = async (m: string, p: Record<string, unknown>) => {
    const res = await fetch(`${url}?${m}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    if (!res.ok) throw new Error(`ISPConfig ${m} failed: ${res.status}`);
    const data = await res.json();
    if (data.code !== "ok") {
      throw new Error(`ISPConfig ${m} failed: ${data.message ?? "unknown"}`);
    }
    return data.response;
  };
  const sessionId = await call("login", {
    username: config.username,
    password: config.password,
  });
  try {
    return await call(method, { session_id: sessionId, ...params });
  } finally {
    await call("logout", { session_id: sessionId }).catch(() => undefined);
  }
}

function domainFor(service: Service): string {
  const entries =
    (service.config as Array<{ envKey?: string; value: string }> | null) ?? [];
  return (
    entries.find((e) => e.envKey === "DOMAIN")?.value ??
    `svc-${service.id.slice(-8)}.example.com`
  );
}

export const ispConfigServer: ServerDriver = {
  slug: "ispconfig",
  name: "ISPConfig",
  configFields: [
    { key: "host", label: "Panel URL", type: "text", required: true, help: "e.g. https://server.example.com:8080" },
    { key: "username", label: "Remote API username", type: "text", required: true },
    { key: "password", label: "Remote API password", type: "password", required: true },
  ],
  productConfigFields: [
    { key: "server_id", label: "Server ID", type: "text", required: true },
    { key: "client_group_id", label: "Client template ID", type: "text" },
    { key: "ip", label: "IP address", type: "text", help: "* for all" },
  ],
  async create(service, config, productConfig) {
    // create a client, then a web domain owned by it
    const clientId = (await ispCall(config, "client_add", {
      reseller_id: 0,
      params: {
        company_name: service.user.companyName ?? "",
        contact_name: `${service.user.firstName} ${service.user.lastName}`,
        username: `oh${service.id.slice(-6)}`,
        password: randomBytes(12).toString("base64url"),
        email: service.user.email,
        default_webserver: Number(productConfig.server_id),
      },
    })) as number;
    const domain = domainFor(service);
    await ispCall(config, "sites_web_domain_add", {
      client_id: clientId,
      params: {
        server_id: Number(productConfig.server_id),
        domain,
        ip_address: productConfig.ip || "*",
        type: "vhost",
        active: "y",
      },
    });
    return `${clientId}:${domain}`;
  },
  async suspend(service, config) {
    const [clientId] = service.externalId?.split(":") ?? [];
    if (!clientId) return;
    // disabling the client's sites is the standard suspend
    await ispCall(config, "client_update", {
      client_id: Number(clientId),
      reseller_id: 0,
      params: { locked: "y" },
    });
  },
  async unsuspend(service, config) {
    const [clientId] = service.externalId?.split(":") ?? [];
    if (!clientId) return;
    await ispCall(config, "client_update", {
      client_id: Number(clientId),
      reseller_id: 0,
      params: { locked: "n" },
    });
  },
  async terminate(service, config) {
    const [clientId] = service.externalId?.split(":") ?? [];
    if (!clientId) return;
    await ispCall(config, "client_delete_everything", {
      client_id: Number(clientId),
    });
  },
};
