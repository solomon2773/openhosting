import type { ResaleDriver } from "@/lib/extensions/types";
import type { User } from "@/generated/prisma/client";

// Openprovider REST API v1beta. Token auth (login → bearer token), then
// customer + domain creation.
async function opLogin(config: Record<string, string>): Promise<string> {
  const res = await fetch("https://api.openprovider.eu/v1beta/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: config.username, password: config.password }),
  });
  if (!res.ok) throw new Error(`Openprovider auth failed: ${res.status}`);
  const data = await res.json();
  return data.data.token as string;
}

async function op(
  token: string,
  method: string,
  path: string,
  body?: unknown,
) {
  const res = await fetch(`https://api.openprovider.eu/v1beta${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (data?.code && data.code !== 0) {
    throw new Error(`Openprovider ${path} failed: ${data.desc ?? data.code}`);
  }
  return data.data;
}

function customerData(user: User) {
  return {
    company_name: user.companyName || undefined,
    name: { first_name: user.firstName, last_name: user.lastName },
    address: {
      street: user.address ?? "N/A",
      number: "1",
      zipcode: user.zip ?? "00000",
      city: user.city ?? "N/A",
      state: user.state ?? "",
      country: user.country ?? "US",
    },
    phone: { country_code: "+1", area_code: "000", subscriber_number: "0000000" },
    email: user.email,
  };
}

export const openProviderResale: ResaleDriver = {
  slug: "openprovider",
  name: "Openprovider (domains)",
  category: "DOMAIN",
  configFields: [
    { key: "username", label: "Username", type: "text", required: true },
    { key: "password", label: "Password", type: "password", required: true },
  ],
  productConfigFields: [
    { key: "years", label: "Registration period (years)", type: "text", help: "Default 1" },
  ],
  checkoutFields: [
    { key: "domain", label: "Domain name", type: "text", required: true },
  ],
  async provision(service, config, productConfig, resaleData) {
    const domain = (resaleData.domain ?? "").toLowerCase().trim();
    const [name, ...rest] = domain.split(".");
    const token = await opLogin(config);
    const handle = await op(token, "POST", "/customers", customerData(service.user));
    const handleId = (handle as { handle?: string }).handle;
    await op(token, "POST", "/domains", {
      domain: { name, extension: rest.join(".") },
      period: Number(productConfig.years || "1"),
      owner_handle: handleId,
      admin_handle: handleId,
      tech_handle: handleId,
      billing_handle: handleId,
      name_servers: [{ name: "ns1.example.com" }, { name: "ns2.example.com" }],
    });
    return domain;
  },
  async renew(service, config, productConfig) {
    if (!service.externalId) return;
    const [name, ...rest] = service.externalId.split(".");
    const token = await opLogin(config);
    await op(token, "POST", "/domains/renew", {
      domain: { name, extension: rest.join(".") },
      period: Number(productConfig.years || "1"),
    });
  },
  async cancel() {
    // Domains lapse at expiry.
  },
};
