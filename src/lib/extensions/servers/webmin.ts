import type { ServerDriver } from "@/lib/extensions/types";
import type { Service } from "@/generated/prisma/client";
import { randomBytes } from "node:crypto";

// Webmin/Virtualmin via the Virtualmin remote API
// (https://host:10000/virtual-server/remote.cgi, basic auth with a Webmin
// account that has Virtualmin admin rights). Each service is a Virtualmin
// virtual server (domain) with web/DNS/mail per the chosen plan.

async function virtualmin(
  config: Record<string, string>,
  program: string,
  params: Record<string, string>,
) {
  const base = config.host?.replace(/\/$/, "");
  const query = new URLSearchParams({ program, json: "1", ...params });
  const res = await fetch(`${base}/virtual-server/remote.cgi?${query}`, {
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${config.username}:${config.password}`,
      ).toString("base64")}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Virtualmin ${program} failed: HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    status?: string;
    error?: string;
  };
  if (data.status !== "success") {
    throw new Error(`Virtualmin ${program} failed: ${data.error ?? "unknown"}`);
  }
  return data;
}

function domainFor(service: Service): string {
  const entries =
    (service.config as Array<{ envKey?: string; value: string }> | null) ?? [];
  return (
    entries.find((e) => e.envKey === "DOMAIN")?.value ??
    `svc-${service.id.slice(-8)}.example.com`
  );
}

export const webminServer: ServerDriver = {
  slug: "webmin",
  name: "Webmin (Virtualmin)",
  configFields: [
    { key: "host", label: "Webmin URL", type: "text", required: true, help: "e.g. https://server.example.com:10000" },
    { key: "username", label: "Webmin username", type: "text", required: true, help: "Needs Virtualmin admin rights (typically root)" },
    { key: "password", label: "Webmin password", type: "password", required: true },
  ],
  productConfigFields: [
    { key: "plan", label: "Virtualmin plan name", type: "text", help: "Blank uses the default plan" },
    { key: "template", label: "Server template", type: "text", help: "Blank uses the default template" },
    {
      key: "features",
      label: "Features",
      type: "select",
      options: [
        { label: "Plan/template defaults", value: "default" },
        { label: "Web + DNS + Mail", value: "web-dns-mail" },
        { label: "Web only", value: "web" },
      ],
    },
    {
      key: "domain_option",
      label: "Domain config option env key",
      type: "text",
      help: "Add a config option with env key DOMAIN so customers enter their domain at checkout.",
    },
  ],
  async create(service, config, productConfig) {
    const domain = domainFor(service);
    const params: Record<string, string> = {
      domain,
      pass: randomBytes(12).toString("base64url"),
      email: service.user.email,
      "limits-from-plan": "",
    };
    if (productConfig.plan) params.plan = productConfig.plan;
    if (productConfig.template) params.template = productConfig.template;
    if (productConfig.features === "web") {
      params.web = "";
    } else if (productConfig.features === "web-dns-mail") {
      params.web = "";
      params.dns = "";
      params.mail = "";
    } else {
      params["default-features"] = "";
    }
    await virtualmin(config, "create-domain", params);
    return domain;
  },
  async suspend(service, config) {
    if (!service.externalId) return;
    await virtualmin(config, "disable-domain", {
      domain: service.externalId,
      why: "Unpaid invoice",
    });
  },
  async unsuspend(service, config) {
    if (!service.externalId) return;
    await virtualmin(config, "enable-domain", { domain: service.externalId });
  },
  async terminate(service, config) {
    if (!service.externalId) return;
    await virtualmin(config, "delete-domain", { domain: service.externalId });
  },
};
