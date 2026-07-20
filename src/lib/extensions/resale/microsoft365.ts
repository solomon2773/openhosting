import type { ResaleDriver } from "@/lib/extensions/types";

// Microsoft 365 seat resale via Partner Center (CSP). OAuth2 client-credentials
// against the partner tenant, then create a customer + subscription order.
async function partnerToken(config: Record<string, string>): Promise<string> {
  const res = await fetch(
    `https://login.microsoftonline.com/${config.tenant_id}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: config.client_id,
        client_secret: config.client_secret,
        scope: "https://api.partnercenter.microsoft.com/.default",
      }),
    },
  );
  if (!res.ok) throw new Error(`Partner Center auth failed: ${res.status}`);
  const data = await res.json();
  return data.access_token as string;
}

async function pc(
  token: string,
  method: string,
  path: string,
  body?: unknown,
) {
  const res = await fetch(`https://api.partnercenter.microsoft.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "MS-CorrelationId": Math.random().toString(36).slice(2),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`Partner Center ${method} ${path} failed: ${res.status}`);
  }
  return res.json();
}

export const microsoft365Resale: ResaleDriver = {
  slug: "microsoft365",
  name: "Microsoft 365 (seats)",
  category: "M365",
  configFields: [
    { key: "tenant_id", label: "Partner tenant ID", type: "text", required: true },
    { key: "client_id", label: "App client ID", type: "text", required: true },
    { key: "client_secret", label: "App client secret", type: "password", required: true },
  ],
  productConfigFields: [
    { key: "offer_id", label: "Offer ID", type: "text", required: true, help: "e.g. Microsoft 365 Business Standard offer id" },
  ],
  checkoutFields: [
    { key: "company", label: "Organization name", type: "text", required: true },
    { key: "domain", label: "Onmicrosoft domain prefix", type: "text", required: true, help: "e.g. contoso → contoso.onmicrosoft.com" },
    { key: "seats", label: "Number of seats", type: "text", required: true },
  ],
  async provision(service, config, productConfig, resaleData) {
    const token = await partnerToken(config);
    // create the customer under the partner tenant
    const customer = await pc(token, "POST", "/v1/customers", {
      companyProfile: {
        domain: `${resaleData.domain}.onmicrosoft.com`,
        companyName: resaleData.company,
      },
      billingProfile: {
        email: service.user.email,
        culture: "en-US",
        language: "en",
        companyName: resaleData.company,
        defaultAddress: {
          firstName: service.user.firstName,
          lastName: service.user.lastName,
          addressLine1: service.user.address ?? "N/A",
          city: service.user.city ?? "N/A",
          state: service.user.state ?? "NA",
          postalCode: service.user.zip ?? "00000",
          country: service.user.country ?? "US",
          phoneNumber: service.user.phone ?? "0000000000",
        },
      },
    });
    const customerId = customer.id as string;
    // place the subscription order
    const order = await pc(token, "POST", `/v1/customers/${customerId}/orders`, {
      lineItems: [
        {
          lineItemNumber: 0,
          offerId: productConfig.offer_id,
          quantity: Number(resaleData.seats || "1"),
        },
      ],
      billingCycle: "monthly",
    });
    return `${customerId}:${order.id}`;
  },
  async cancel(service, config) {
    const [customerId, orderId] = service.externalId?.split(":") ?? [];
    if (!customerId || !orderId) return;
    const token = await partnerToken(config);
    // suspend all subscriptions on the order
    const subs = await pc(token, "GET", `/v1/customers/${customerId}/subscriptions?order_id=${orderId}`);
    for (const sub of (subs.items ?? []) as Array<{ id: string }>) {
      await pc(token, "PATCH", `/v1/customers/${customerId}/subscriptions/${sub.id}`, {
        status: "suspended",
      }).catch(() => undefined);
    }
  },
};
