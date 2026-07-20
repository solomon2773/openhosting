import type { ResaleDriver } from "@/lib/extensions/types";

// Google Workspace seat resale via the Google Reseller API. Service-account
// JWT (signed with the reseller's key) exchanged for an access token, then a
// customer + subscription is created.
import { createSign } from "node:crypto";

async function resellerToken(config: Record<string, string>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const claim = Buffer.from(JSON.stringify({
    iss: config.client_email,
    sub: config.admin_email,
    scope: "https://www.googleapis.com/auth/apps.order",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })).toString("base64url");
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  const signature = signer.sign(config.private_key.replace(/\\n/g, "\n"), "base64url");
  const jwt = `${header}.${claim}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`Google auth failed: ${res.status}`);
  const data = await res.json();
  return data.access_token as string;
}

async function reseller(
  token: string,
  method: string,
  path: string,
  body?: unknown,
) {
  const res = await fetch(`https://reseller.googleapis.com/apps/reseller/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Google Reseller ${method} ${path} failed: ${res.status}`);
  return res.json();
}

export const googleWorkspaceResale: ResaleDriver = {
  slug: "google-workspace",
  name: "Google Workspace (seats)",
  category: "M365",
  configFields: [
    { key: "client_email", label: "Service account email", type: "text", required: true },
    { key: "private_key", label: "Service account private key", type: "password", required: true, help: "PEM; \\n escapes are handled" },
    { key: "admin_email", label: "Reseller admin email to impersonate", type: "text", required: true },
  ],
  productConfigFields: [
    { key: "sku_id", label: "SKU ID", type: "text", required: true, help: "e.g. Google-Apps-For-Business" },
    { key: "plan", label: "Plan name", type: "text", help: "ANNUAL_MONTHLY_PAY / FLEXIBLE", required: true },
  ],
  checkoutFields: [
    { key: "domain", label: "Customer primary domain", type: "text", required: true },
    { key: "seats", label: "Number of seats", type: "text", required: true },
  ],
  async provision(service, config, productConfig, resaleData) {
    const token = await resellerToken(config);
    // create-or-reference the customer, then place the subscription
    await reseller(token, "POST", "/customers", {
      customerDomain: resaleData.domain,
      alternateEmail: service.user.email,
      postalAddress: {
        contactName: `${service.user.firstName} ${service.user.lastName}`,
        organizationName: service.user.companyName ?? resaleData.domain,
        countryCode: service.user.country ?? "US",
      },
    }).catch(() => undefined); // customer may already exist
    const sub = await reseller(token, "POST", `/customers/${resaleData.domain}/subscriptions`, {
      skuId: productConfig.sku_id,
      plan: { planName: productConfig.plan },
      seats: {
        numberOfSeats: Number(resaleData.seats || "1"),
        maximumNumberOfSeats: Number(resaleData.seats || "1"),
      },
    });
    return `${resaleData.domain}:${sub.subscriptionId}`;
  },
  async cancel(service, config) {
    const [domain, subId] = service.externalId?.split(":") ?? [];
    if (!domain || !subId) return;
    const token = await resellerToken(config);
    await reseller(token, "DELETE", `/customers/${domain}/subscriptions/${subId}?deletionType=cancel`);
  },
};
