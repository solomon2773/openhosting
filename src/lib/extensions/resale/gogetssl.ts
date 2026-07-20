import type { ResaleDriver } from "@/lib/extensions/types";

// GoGetSSL reseller API (token auth). Places an SSL order from a customer CSR;
// the external ref is the order id used for status/renewal.
async function ggs(
  config: Record<string, string>,
  method: string,
  path: string,
  token: string,
  body?: Record<string, unknown>,
) {
  const res = await fetch(`https://my.gogetssl.com/api${path}?auth_key=${token}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`GoGetSSL ${path} failed: ${res.status}`);
  const data = await res.json();
  if (data?.success === false) {
    throw new Error(`GoGetSSL ${path} failed: ${data.description ?? data.message}`);
  }
  return data;
}

async function authKey(config: Record<string, string>): Promise<string> {
  const res = await fetch("https://my.gogetssl.com/api/auth/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user: config.username, pass: config.password }),
  });
  const data = await res.json();
  if (!data?.key) throw new Error("GoGetSSL auth failed");
  return data.key as string;
}

export const goGetSslResale: ResaleDriver = {
  slug: "gogetssl",
  name: "GoGetSSL (SSL certificates)",
  category: "SSL",
  configFields: [
    { key: "username", label: "Account email", type: "text", required: true },
    { key: "password", label: "Password", type: "password", required: true },
  ],
  productConfigFields: [
    { key: "product_id", label: "GoGetSSL product ID", type: "text", required: true },
    { key: "years", label: "Validity (years)", type: "text", help: "Default 1" },
  ],
  checkoutFields: [
    { key: "csr", label: "CSR", type: "text", required: true, help: "Paste your Certificate Signing Request" },
    { key: "domain", label: "Common name (domain)", type: "text", required: true },
    { key: "approver_email", label: "Approver email", type: "text", required: true },
  ],
  async provision(service, config, productConfig, resaleData) {
    const token = await authKey(config);
    const order = await ggs(config, "POST", "/orders/add_ssl_order/", token, {
      product_id: Number(productConfig.product_id),
      period: Number(productConfig.years || "1") * 12,
      csr: resaleData.csr,
      server_count: -1,
      approver_email: resaleData.approver_email,
      webserver_type: -1,
      dcv_method: "email",
      admin_firstname: service.user.firstName,
      admin_lastname: service.user.lastName,
      admin_email: service.user.email,
      admin_phone: service.user.phone ?? "+1.0000000000",
      admin_title: "IT",
      tech_firstname: service.user.firstName,
      tech_lastname: service.user.lastName,
      tech_email: service.user.email,
      tech_phone: service.user.phone ?? "+1.0000000000",
      tech_title: "IT",
    });
    return String(order.order_id);
  },
  async cancel() {
    // Issued certificates are not revoked automatically on cancellation.
  },
};
