import type { GatewayDriver } from "@/lib/extensions/types";

// Stripe Checkout via the REST API — no SDK dependency needed.
async function stripeRequest(
  secretKey: string,
  path: string,
  params: Record<string, string>,
) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Stripe API error ${res.status}: ${body}`);
  }
  return res.json();
}

export const stripeGateway: GatewayDriver = {
  slug: "stripe",
  name: "Stripe",
  configFields: [
    { key: "secret_key", label: "Secret key", type: "password", required: true },
    {
      key: "webhook_secret",
      label: "Webhook signing secret",
      type: "password",
      help: "From the Stripe dashboard webhook endpoint (checkout.session.completed).",
    },
  ],
  async pay(invoice, config, urls) {
    const session = await stripeRequest(config.secret_key, "/checkout/sessions", {
      mode: "payment",
      "line_items[0][price_data][currency]": invoice.currency.toLowerCase(),
      "line_items[0][price_data][product_data][name]": `Invoice #${invoice.number}`,
      "line_items[0][price_data][unit_amount]": String(
        Math.round(Number(invoice.total) * 100),
      ),
      "line_items[0][quantity]": "1",
      customer_email: invoice.user.email,
      client_reference_id: invoice.id,
      "metadata[invoice_id]": invoice.id,
      success_url: urls.success,
      cancel_url: urls.cancel,
    });
    return { type: "redirect", url: session.url as string };
  },
  async handleWebhook(request) {
    // Signature verification is done in the webhook route (needs the raw body).
    const event = (await request.json()) as {
      type: string;
      data: { object: { id: string; metadata?: { invoice_id?: string } } };
    };
    if (event.type !== "checkout.session.completed") return null;
    const invoiceId = event.data.object.metadata?.invoice_id;
    if (!invoiceId) return null;
    return { invoiceId, transactionId: event.data.object.id };
  },
};
