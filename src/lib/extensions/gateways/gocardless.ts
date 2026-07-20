import type { GatewayDriver } from "@/lib/extensions/types";

// GoCardless — SEPA / Bacs direct debit for EU/UK recurring. Uses a
// billing-request flow to authorise a mandate and collect the payment.
async function gc(
  config: Record<string, string>,
  method: string,
  path: string,
  body?: unknown,
) {
  const base = config.environment === "live"
    ? "https://api.gocardless.com"
    : "https://api-sandbox.gocardless.com";
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.access_token}`,
      "GoCardless-Version": "2015-07-06",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`GoCardless ${path} failed: ${res.status}`);
  return res.json();
}

export const goCardlessGateway: GatewayDriver = {
  slug: "gocardless",
  name: "GoCardless (SEPA / direct debit)",
  configFields: [
    { key: "access_token", label: "Access token", type: "password", required: true },
    { key: "environment", label: "Environment", type: "select", options: [
      { label: "Sandbox", value: "sandbox" },
      { label: "Live", value: "live" },
    ] },
    { key: "webhook_secret", label: "Webhook secret", type: "password" },
  ],
  async pay(invoice, config, urls) {
    const br = await gc(config, "POST", "/billing_requests", {
      billing_requests: {
        payment_request: {
          description: `Invoice #${invoice.number}`,
          amount: Math.round(Number(invoice.total) * 100),
          currency: invoice.currency,
          metadata: { invoice_id: invoice.id },
        },
        mandate_request: { currency: invoice.currency },
      },
    });
    const flow = await gc(config, "POST", "/billing_request_flows", {
      billing_request_flows: {
        redirect_uri: urls.success,
        exit_uri: urls.cancel,
        links: { billing_request: br.billing_requests.id },
      },
    });
    return { type: "redirect", url: flow.billing_request_flows.authorisation_url as string };
  },
  async handleWebhook(request, config) {
    const body = (await request.json()) as {
      events?: Array<{
        resource_type?: string;
        action?: string;
        links?: { payment?: string };
      }>;
    };
    for (const event of body.events ?? []) {
      if (
        event.resource_type === "payments" &&
        (event.action === "confirmed" || event.action === "paid_out") &&
        event.links?.payment
      ) {
        // the webhook omits metadata; fetch the payment to read invoice_id
        const payment = await gc(
          config,
          "GET",
          `/payments/${event.links.payment}`,
        );
        const invoiceId = payment?.payments?.metadata?.invoice_id;
        if (invoiceId) {
          return { invoiceId, transactionId: event.links.payment };
        }
      }
    }
    return null;
  },
};
