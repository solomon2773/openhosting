import type { GatewayDriver } from "@/lib/extensions/types";

async function mollieRequest(
  apiKey: string,
  method: string,
  path: string,
  body?: unknown,
) {
  const res = await fetch(`https://api.mollie.com/v2${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`Mollie API ${method} ${path} failed: ${res.status}`);
  }
  return res.json();
}

export const mollieGateway: GatewayDriver = {
  slug: "mollie",
  name: "Mollie",
  configFields: [
    {
      key: "api_key",
      label: "API key",
      type: "password",
      required: true,
      help: "test_… or live_… key from the Mollie dashboard.",
    },
  ],
  async pay(invoice, config, urls) {
    const payment = await mollieRequest(config.api_key, "POST", "/payments", {
      amount: {
        currency: invoice.currency,
        value: Number(invoice.total).toFixed(2),
      },
      description: `Invoice #${invoice.number}`,
      redirectUrl: urls.success,
      webhookUrl: urls.webhook,
      metadata: { invoice_id: invoice.id },
    });
    return { type: "redirect", url: payment._links.checkout.href as string };
  },
  // Mollie posts `id=tr_…` and expects us to fetch the payment for its state.
  async handleWebhook(request, config) {
    const form = await request.formData().catch(() => null);
    const paymentId = form?.get("id");
    if (!paymentId) return null;
    const payment = await mollieRequest(
      config.api_key,
      "GET",
      `/payments/${encodeURIComponent(String(paymentId))}`,
    );
    if (payment.status !== "paid") return null;
    const invoiceId = payment.metadata?.invoice_id;
    if (!invoiceId) return null;
    return { invoiceId, transactionId: String(paymentId) };
  },
};
