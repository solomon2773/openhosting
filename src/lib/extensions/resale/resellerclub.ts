import type { ResaleDriver } from "@/lib/extensions/types";
import type { User } from "@/generated/prisma/client";

// ResellerClub / LogicBoxes HTTP API (json). Contacts are created then a
// domain is registered against them.
async function rc(
  config: Record<string, string>,
  path: string,
  params: Record<string, string>,
) {
  const base = config.sandbox === "true"
    ? "https://test.httpapi.com/api"
    : "https://httpapi.com/api";
  const query = new URLSearchParams({
    "auth-userid": config.reseller_id,
    "api-key": config.api_key,
    ...params,
  });
  const res = await fetch(`${base}${path}?${query}`, { method: "POST" });
  const data = await res.json();
  if (data?.status === "ERROR" || data?.message) {
    if (data?.status === "ERROR") throw new Error(`ResellerClub ${path}: ${data.message}`);
  }
  return data;
}

async function createContact(config: Record<string, string>, user: User) {
  const data = await rc(config, "/contacts/add.json", {
    name: `${user.firstName} ${user.lastName}`,
    company: user.companyName || "N/A",
    email: user.email,
    "address-line-1": user.address ?? "N/A",
    city: user.city ?? "N/A",
    state: user.state ?? "N/A",
    country: user.country ?? "US",
    zipcode: user.zip ?? "00000",
    "phone-cc": "1",
    phone: (user.phone ?? "0000000000").replace(/\D/g, "").slice(-10) || "0000000000",
    type: "Contact",
    "customer-id": config.customer_id,
  });
  return String(data);
}

export const resellerClubResale: ResaleDriver = {
  slug: "resellerclub",
  name: "ResellerClub (domains)",
  category: "DOMAIN",
  configFields: [
    { key: "reseller_id", label: "Reseller ID", type: "text", required: true },
    { key: "api_key", label: "API key", type: "password", required: true },
    { key: "customer_id", label: "Default customer ID", type: "text", required: true },
    { key: "sandbox", label: "Sandbox mode", type: "checkbox" },
  ],
  productConfigFields: [
    { key: "years", label: "Registration period (years)", type: "text", help: "Default 1" },
  ],
  checkoutFields: [
    { key: "domain", label: "Domain name", type: "text", required: true },
  ],
  async provision(service, config, productConfig, resaleData) {
    const domain = (resaleData.domain ?? "").toLowerCase().trim();
    const contactId = await createContact(config, service.user);
    await rc(config, "/domains/register.json", {
      "domain-name": domain,
      years: productConfig.years || "1",
      ns: "ns1.example.com",
      "customer-id": config.customer_id,
      "reg-contact-id": contactId,
      "admin-contact-id": contactId,
      "tech-contact-id": contactId,
      "billing-contact-id": contactId,
      "invoice-option": "NoInvoice",
    });
    return domain;
  },
  async renew(service, config, productConfig) {
    if (!service.externalId) return;
    const details = await rc(config, "/domains/details-by-name.json", {
      "domain-name": service.externalId,
      "options": "OrderDetails",
    });
    const orderId = (details as { orderid?: string }).orderid;
    if (!orderId) return;
    await rc(config, "/domains/renew.json", {
      "order-id": orderId,
      years: productConfig.years || "1",
      "exp-date": String(Math.floor(Date.now() / 1000)),
      "invoice-option": "NoInvoice",
    });
  },
  async cancel() {
    // Domains lapse at expiry; no immediate delete.
  },
};
