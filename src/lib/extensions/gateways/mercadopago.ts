import type { GatewayDriver } from "@/lib/extensions/types";

// Mercado Pago (LatAm, incl. PIX in Brazil) — Checkout Pro preference.
export const mercadoPagoGateway: GatewayDriver = {
  slug: "mercadopago",
  name: "Mercado Pago (PIX / LatAm)",
  configFields: [
    { key: "access_token", label: "Access token", type: "password", required: true },
  ],
  async pay(invoice, config, urls) {
    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [
          {
            title: `Invoice #${invoice.number}`,
            quantity: 1,
            currency_id: invoice.currency,
            unit_price: Number(invoice.total),
          },
        ],
        external_reference: invoice.id,
        payer: { email: invoice.user.email },
        back_urls: { success: urls.success, failure: urls.cancel, pending: urls.success },
        notification_url: urls.webhook,
        auto_return: "approved",
      }),
    });
    if (!res.ok) throw new Error(`Mercado Pago error: ${res.status}`);
    const data = await res.json();
    return { type: "redirect", url: data.init_point as string };
  },
  // MP notifies with a payment id; fetch it to read status + external reference.
  async handleWebhook(request, config) {
    const url = new URL(request.url);
    const type = url.searchParams.get("type") ?? url.searchParams.get("topic");
    const paymentId = url.searchParams.get("data.id") ?? url.searchParams.get("id");
    if (type !== "payment" || !paymentId) return null;
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${config.access_token}` },
    });
    if (!res.ok) return null;
    const payment = await res.json();
    if (payment.status !== "approved") return null;
    const invoiceId = payment.external_reference;
    if (!invoiceId) return null;
    return { invoiceId, transactionId: String(paymentId) };
  },
};
