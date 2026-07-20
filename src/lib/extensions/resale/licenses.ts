import type { ResaleDriver } from "@/lib/extensions/types";

// Software license resale via the WHMCS-standard licensing.cloud / lc.cloud
// style API used by cPanel, LiteSpeed and Softaculous distributors. A single
// driver covers all three because they share the reseller license API shape;
// the product config picks which package.
async function licenseApi(
  config: Record<string, string>,
  action: string,
  params: Record<string, string>,
) {
  const base = config.api_url.replace(/\/$/, "");
  const body = new URLSearchParams({
    key: config.api_key,
    action,
    ...params,
  });
  const res = await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`License API ${action} failed: ${res.status}`);
  const data = await res.json().catch(() => ({ status: 0 }));
  if (data.status !== 1 && data.success !== true) {
    throw new Error(`License API ${action} failed: ${data.error ?? JSON.stringify(data)}`);
  }
  return data;
}

export const licenseResale: ResaleDriver = {
  slug: "software-license",
  name: "Software license (cPanel / LiteSpeed / Softaculous)",
  category: "LICENSE",
  configFields: [
    { key: "api_url", label: "License API endpoint", type: "text", required: true, help: "Your distributor's reseller API URL" },
    { key: "api_key", label: "API key", type: "password", required: true },
  ],
  productConfigFields: [
    {
      key: "product",
      label: "License product",
      type: "select",
      required: true,
      options: [
        { label: "cPanel", value: "cpanel" },
        { label: "LiteSpeed Web Server", value: "litespeed" },
        { label: "Softaculous", value: "softaculous" },
        { label: "CloudLinux", value: "cloudlinux" },
        { label: "Imunify360", value: "imunify360" },
      ],
    },
    { key: "package", label: "Package/tier", type: "text", required: true, help: "e.g. cPanel Admin (5 accounts)" },
  ],
  checkoutFields: [
    { key: "ip", label: "Server IP address", type: "text", required: true, help: "The IP the license binds to" },
  ],
  async provision(_service, config, productConfig, resaleData) {
    const data = await licenseApi(config, "create", {
      product: productConfig.product,
      package: productConfig.package,
      ip: resaleData.ip,
    });
    return String(data.license_id ?? data.licenseid ?? resaleData.ip);
  },
  async cancel(service, config) {
    if (!service.externalId) return;
    await licenseApi(config, "cancel", { license_id: service.externalId });
  },
};
