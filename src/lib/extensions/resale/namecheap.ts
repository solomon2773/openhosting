import type { ResaleDriver } from "@/lib/extensions/types";
import type { User } from "@/generated/prisma/client";

// Namecheap API (XML). Requires the caller's whitelisted IP as ClientIp.
async function namecheap(
  config: Record<string, string>,
  command: string,
  params: Record<string, string>,
): Promise<string> {
  const base = config.sandbox === "true"
    ? "https://api.sandbox.namecheap.com/xml.response"
    : "https://api.namecheap.com/xml.response";
  const query = new URLSearchParams({
    ApiUser: config.api_user,
    ApiKey: config.api_key,
    UserName: config.username || config.api_user,
    ClientIp: config.client_ip,
    Command: command,
    ...params,
  });
  const res = await fetch(`${base}?${query}`);
  const text = await res.text();
  if (/Status="ERROR"/.test(text) || /<Errors>[\s\S]*?<Error/.test(text)) {
    const msg = text.match(/<Error[^>]*>([^<]+)<\/Error>/)?.[1] ?? "unknown";
    throw new Error(`Namecheap ${command} failed: ${msg}`);
  }
  return text;
}

function contactParams(user: User): Record<string, string> {
  const p: Record<string, string> = {};
  for (const t of ["Registrant", "Tech", "Admin", "AuxBilling"]) {
    p[`${t}FirstName`] = user.firstName;
    p[`${t}LastName`] = user.lastName;
    p[`${t}Address1`] = user.address ?? "N/A";
    p[`${t}City`] = user.city ?? "N/A";
    p[`${t}StateProvince`] = user.state ?? "NA";
    p[`${t}PostalCode`] = user.zip ?? "00000";
    p[`${t}Country`] = user.country ?? "US";
    p[`${t}Phone`] = user.phone ?? "+1.0000000000";
    p[`${t}EmailAddress`] = user.email;
  }
  return p;
}

export const namecheapResale: ResaleDriver = {
  slug: "namecheap",
  name: "Namecheap (domains)",
  category: "DOMAIN",
  configFields: [
    { key: "api_user", label: "API user", type: "text", required: true },
    { key: "api_key", label: "API key", type: "password", required: true },
    { key: "username", label: "Username", type: "text", help: "Defaults to API user" },
    { key: "client_ip", label: "Whitelisted client IP", type: "text", required: true },
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
    await namecheap(config, "namecheap.domains.create", {
      DomainName: domain,
      Years: productConfig.years || "1",
      ...contactParams(service.user),
    });
    return domain;
  },
  async renew(service, config, productConfig) {
    if (!service.externalId) return;
    await namecheap(config, "namecheap.domains.renew", {
      DomainName: service.externalId,
      Years: productConfig.years || "1",
    });
  },
  async cancel() {
    // Domains lapse at expiry.
  },
};
