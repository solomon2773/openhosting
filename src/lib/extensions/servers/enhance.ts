import type { ServerDriver } from "@/lib/extensions/types";
import type { Service } from "@/generated/prisma/client";

// Enhance control panel API (Bearer org token, apidocs.enhance.com).
async function enhance(
  config: Record<string, string>,
  method: string,
  path: string,
  body?: unknown,
) {
  const base = config.api_url?.replace(/\/$/, "") ?? "";
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.access_token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`Enhance ${method} ${path} failed: ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

function domainFor(service: Service): string {
  const entries =
    (service.config as Array<{ envKey?: string; value: string }> | null) ?? [];
  return (
    entries.find((e) => e.envKey === "DOMAIN")?.value ??
    `oh-${service.id.slice(-8)}.example.com`
  );
}

export const enhanceServer: ServerDriver = {
  slug: "enhance",
  name: "Enhance",
  configFields: [
    { key: "api_url", label: "API URL", type: "text", required: true, help: "e.g. https://cp.example.com/api" },
    { key: "org_id", label: "Organization ID", type: "text", required: true },
    { key: "access_token", label: "Access token", type: "password", required: true },
  ],
  productConfigFields: [
    { key: "plan_id", label: "Plan ID", type: "text", required: true },
  ],
  async create(service, config, productConfig) {
    const org = config.org_id;
    // one customer org per user, keyed by email
    const customers = await enhance(config, "GET", `/orgs/${org}/customers`);
    let customerId = (
      customers?.items as Array<{ id: string; name: string }> | undefined
    )?.find((c) => c.name === service.user.email)?.id;
    if (!customerId) {
      const created = await enhance(config, "POST", `/orgs/${org}/customers`, {
        name: service.user.email,
      });
      customerId = created.id as string;
    }
    const subscription = await enhance(
      config,
      "POST",
      `/orgs/${org}/customers/${customerId}/subscriptions`,
      { planId: Number(productConfig.plan_id) },
    );
    await enhance(config, "POST", `/orgs/${customerId}/websites`, {
      domain: domainFor(service),
      subscriptionId: subscription.id,
    });
    return `${customerId}:${subscription.id}`;
  },
  async suspend(service, config) {
    const [customerId, subscriptionId] = service.externalId?.split(":") ?? [];
    if (!subscriptionId) return;
    await enhance(
      config,
      "PATCH",
      `/orgs/${config.org_id}/customers/${customerId}/subscriptions/${subscriptionId}`,
      { isSuspended: true },
    );
  },
  async unsuspend(service, config) {
    const [customerId, subscriptionId] = service.externalId?.split(":") ?? [];
    if (!subscriptionId) return;
    await enhance(
      config,
      "PATCH",
      `/orgs/${config.org_id}/customers/${customerId}/subscriptions/${subscriptionId}`,
      { isSuspended: false },
    );
  },
  async terminate(service, config) {
    const [customerId, subscriptionId] = service.externalId?.split(":") ?? [];
    if (!subscriptionId) return;
    await enhance(
      config,
      "DELETE",
      `/orgs/${config.org_id}/customers/${customerId}/subscriptions/${subscriptionId}`,
    );
  },
};
