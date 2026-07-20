import type { ResaleDriver } from "@/lib/extensions/types";
import type { User } from "@/generated/prisma/client";
import { createHmac } from "node:crypto";

// OpenSRS (Tucows) reseller API — XML over HTTPS with an MD5-signed header.
function md5(s: string): string {
  return createHmac("md5", "").update(s).digest("hex");
}

async function opensrs(
  config: Record<string, string>,
  xml: string,
): Promise<string> {
  const host = config.sandbox === "true"
    ? "https://horizon.opensrs.net:55443"
    : "https://rr-n1-tor.opensrs.net:55443";
  // signature = md5(md5(xml + key) + key)
  const signature = md5(md5(xml + config.api_key) + config.api_key);
  const res = await fetch(host, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml",
      "X-Username": config.username,
      "X-Signature": signature,
    },
    body: xml,
  });
  const text = await res.text();
  if (/<item key="is_success">0<\/item>/.test(text)) {
    const msg = text.match(/<item key="response_text">([^<]+)</)?.[1] ?? "unknown";
    throw new Error(`OpenSRS failed: ${msg}`);
  }
  return text;
}

function buildRegisterXml(domain: string, years: string, user: User): string {
  const contact = `
    <dt_assoc>
      <item key="first_name">${user.firstName}</item>
      <item key="last_name">${user.lastName}</item>
      <item key="org_name">${user.companyName ?? user.firstName}</item>
      <item key="address1">${user.address ?? "N/A"}</item>
      <item key="city">${user.city ?? "N/A"}</item>
      <item key="state">${user.state ?? "NA"}</item>
      <item key="postal_code">${user.zip ?? "00000"}</item>
      <item key="country">${user.country ?? "US"}</item>
      <item key="phone">${user.phone ?? "+1.0000000000"}</item>
      <item key="email">${user.email}</item>
    </dt_assoc>`;
  return `<?xml version='1.0' encoding='UTF-8' standalone='no'?>
<!DOCTYPE OPS_envelope SYSTEM 'ops.dtd'>
<OPS_envelope><header><version>0.9</version></header><body><data_block>
<dt_assoc>
  <item key="protocol">XCP</item>
  <item key="action">SW_REGISTER</item>
  <item key="object">DOMAIN</item>
  <item key="attributes"><dt_assoc>
    <item key="domain">${domain}</item>
    <item key="period">${years}</item>
    <item key="reg_username">${domain.replace(/\W/g, "").slice(0, 20)}</item>
    <item key="reg_password">${Math.random().toString(36).slice(2, 14)}</item>
    <item key="contact_set"><dt_assoc>
      <item key="owner">${contact}</item>
      <item key="admin">${contact}</item>
      <item key="billing">${contact}</item>
      <item key="tech">${contact}</item>
    </dt_assoc></item>
  </dt_assoc></item>
</dt_assoc>
</data_block></body></OPS_envelope>`;
}

export const openSrsResale: ResaleDriver = {
  slug: "opensrs",
  name: "OpenSRS (domains)",
  category: "DOMAIN",
  configFields: [
    { key: "username", label: "Reseller username", type: "text", required: true },
    { key: "api_key", label: "API key", type: "password", required: true },
    { key: "sandbox", label: "Sandbox (horizon)", type: "checkbox" },
  ],
  productConfigFields: [
    { key: "years", label: "Registration period (years)", type: "text", help: "Default 1" },
  ],
  checkoutFields: [
    { key: "domain", label: "Domain name", type: "text", required: true },
  ],
  async provision(service, config, productConfig, resaleData) {
    const domain = (resaleData.domain ?? "").toLowerCase().trim();
    await opensrs(config, buildRegisterXml(domain, productConfig.years || "1", service.user));
    return domain;
  },
  async cancel() {
    // Domains lapse at expiry.
  },
};
