import type { ResaleDriver } from "@/lib/extensions/types";
import type { Service, User } from "@/generated/prisma/client";

// Enom reseller API (reseller.enom.com, command-based, responseType=json).
async function enom(
  config: Record<string, string>,
  command: string,
  params: Record<string, string>,
) {
  const base = config.sandbox === "true"
    ? "https://resellertest.enom.com/interface.asp"
    : "https://reseller.enom.com/interface.asp";
  const query = new URLSearchParams({
    command,
    uid: config.username,
    pw: config.api_token,
    responsetype: "json",
    ...params,
  });
  const res = await fetch(`${base}?${query}`);
  if (!res.ok) throw new Error(`Enom ${command} failed: HTTP ${res.status}`);
  const data = await res.json();
  const errCount = Number(data?.interface_response?.ErrCount ?? 0);
  if (errCount > 0) {
    const err = data.interface_response?.errors ?? data.interface_response?.responses;
    throw new Error(`Enom ${command} failed: ${JSON.stringify(err)}`);
  }
  return data.interface_response;
}

function splitDomain(domain: string): { sld: string; tld: string } {
  const [sld, ...rest] = domain.split(".");
  return { sld, tld: rest.join(".") };
}

function contactParams(user: User, domain: string): Record<string, string> {
  const p: Record<string, string> = {};
  for (const t of ["Registrant", "AuxBilling", "Tech", "Admin"]) {
    p[`${t}FirstName`] = user.firstName;
    p[`${t}LastName`] = user.lastName;
    p[`${t}Address1`] = user.address ?? "N/A";
    p[`${t}City`] = user.city ?? "N/A";
    p[`${t}StateProvince`] = user.state ?? "N/A";
    p[`${t}PostalCode`] = user.zip ?? "00000";
    p[`${t}Country`] = user.country ?? "US";
    p[`${t}EmailAddress`] = user.email;
    p[`${t}Phone`] = user.phone ?? "+1.0000000000";
  }
  return p;
}

export const enomResale: ResaleDriver = {
  slug: "enom",
  name: "Enom (domains)",
  category: "DOMAIN",
  configFields: [
    { key: "username", label: "Reseller login ID", type: "text", required: true },
    { key: "api_token", label: "API token", type: "password", required: true },
    { key: "sandbox", label: "Sandbox mode", type: "checkbox" },
  ],
  productConfigFields: [
    { key: "years", label: "Registration period (years)", type: "text", help: "Default 1" },
  ],
  checkoutFields: [
    { key: "domain", label: "Domain name", type: "text", required: true, help: "e.g. example.com" },
  ],
  async provision(service, config, productConfig, resaleData) {
    const domain = (resaleData.domain ?? "").toLowerCase().trim();
    const { sld, tld } = splitDomain(domain);
    await enom(config, "Purchase", {
      sld,
      tld,
      NumYears: productConfig.years || "1",
      ...contactParams(service.user, domain),
    });
    return domain;
  },
  async renew(service, config, productConfig) {
    if (!service.externalId) return;
    const { sld, tld } = splitDomain(service.externalId);
    await enom(config, "Extend", { sld, tld, NumYears: productConfig.years || "1" });
  },
  async cancel() {
    // Domains are not deleted on cancellation — they simply lapse at expiry.
    // Enom has no immediate-delete for registered domains via reseller API.
  },
};
