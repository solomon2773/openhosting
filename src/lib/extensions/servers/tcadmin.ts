import type { ServerDriver } from "@/lib/extensions/types";
import type { Service } from "@/generated/prisma/client";

// TCAdmin 2 game-server panel via its billing API
// (Service.aspx / BillingApi endpoints, key auth).
async function tcadmin(
  config: Record<string, string>,
  action: string,
  params: Record<string, string>,
) {
  const base = config.host?.replace(/\/$/, "");
  const body = new URLSearchParams({
    key: config.api_key,
    action,
    ...params,
  });
  const res = await fetch(`${base}/billingapi.aspx`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`TCAdmin ${action} failed: ${res.status}`);
  const text = await res.text();
  if (/error/i.test(text) && !/success/i.test(text)) {
    throw new Error(`TCAdmin ${action} failed: ${text.slice(0, 200)}`);
  }
  return text;
}

function overrides(service: Service): Record<string, string> {
  const entries =
    (service.config as Array<{ envKey?: string; value: string }> | null) ?? [];
  return Object.fromEntries(
    entries.filter((e) => e.envKey).map((e) => [e.envKey as string, e.value]),
  );
}

export const tcadminServer: ServerDriver = {
  slug: "tcadmin",
  name: "TCAdmin 2",
  configFields: [
    { key: "host", label: "TCAdmin URL", type: "text", required: true },
    { key: "api_key", label: "API key", type: "password", required: true },
  ],
  productConfigFields: [
    { key: "package_id", label: "Package ID", type: "text", required: true },
    { key: "game_id", label: "Game ID", type: "text", required: true },
    { key: "slots", label: "Slots", type: "text" },
  ],
  async create(service, config, productConfig) {
    const custom = overrides(service);
    const result = await tcadmin(config, "createservice", {
      packageid: productConfig.package_id,
      gameid: productConfig.game_id,
      slots: custom.SLOTS ?? productConfig.slots ?? "12",
      email: service.user.email,
      firstname: service.user.firstName,
      lastname: service.user.lastName,
      username: `oh${service.id.slice(-6)}`,
    });
    const match = result.match(/serviceid[=:]\s*(\d+)/i);
    return match ? match[1] : `svc-${service.id.slice(-8)}`;
  },
  async suspend(service, config) {
    if (!service.externalId) return;
    await tcadmin(config, "suspendservice", { serviceid: service.externalId });
  },
  async unsuspend(service, config) {
    if (!service.externalId) return;
    await tcadmin(config, "unsuspendservice", { serviceid: service.externalId });
  },
  async terminate(service, config) {
    if (!service.externalId) return;
    await tcadmin(config, "deleteservice", { serviceid: service.externalId });
  },
};
