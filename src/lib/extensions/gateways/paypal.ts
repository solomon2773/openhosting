import type { GatewayDriver } from "@/lib/extensions/types";

function apiBase(config: Record<string, string>) {
  return config.sandbox === "true"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";
}

async function getAccessToken(config: Record<string, string>) {
  const res = await fetch(`${apiBase(config)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${config.client_id}:${config.client_secret}`,
      ).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status}`);
  const data = await res.json();
  return data.access_token as string;
}

export const paypalGateway: GatewayDriver = {
  slug: "paypal",
  name: "PayPal",
  configFields: [
    { key: "client_id", label: "Client ID", type: "text", required: true },
    { key: "client_secret", label: "Client secret", type: "password", required: true },
    { key: "sandbox", label: "Sandbox mode", type: "checkbox" },
  ],
  async pay(invoice, config, urls) {
    const token = await getAccessToken(config);
    const res = await fetch(`${apiBase(config)}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: invoice.id,
            custom_id: invoice.id,
            description: `Invoice #${invoice.number}`,
            amount: {
              currency_code: invoice.currency,
              value: Number(invoice.total).toFixed(2),
            },
          },
        ],
        application_context: {
          return_url: urls.success,
          cancel_url: urls.cancel,
        },
      }),
    });
    if (!res.ok) throw new Error(`PayPal order failed: ${res.status}`);
    const order = await res.json();
    const approve = (
      order.links as Array<{ rel: string; href: string }>
    ).find((l) => l.rel === "approve");
    if (!approve) throw new Error("PayPal did not return an approval link");
    return { type: "redirect", url: approve.href };
  },
  async handleWebhook(request) {
    const event = (await request.json()) as {
      event_type: string;
      resource?: { id?: string; custom_id?: string };
    };
    if (
      event.event_type !== "CHECKOUT.ORDER.APPROVED" &&
      event.event_type !== "PAYMENT.CAPTURE.COMPLETED"
    ) {
      return null;
    }
    const invoiceId = event.resource?.custom_id;
    if (!invoiceId) return null;
    return { invoiceId, transactionId: event.resource?.id ?? "paypal" };
  },
};
