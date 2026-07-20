import type { GatewayDriver } from "@/lib/extensions/types";

// Square — hosted Payment Links (Checkout API). Amounts in the smallest
// currency unit.
export const squareGateway: GatewayDriver = {
  slug: "square",
  name: "Square",
  configFields: [
    { key: "access_token", label: "Access token", type: "password", required: true },
    { key: "location_id", label: "Location ID", type: "text", required: true },
    { key: "production", label: "Production mode", type: "checkbox" },
    { key: "webhook_signature_key", label: "Webhook signature key", type: "password" },
  ],
  async pay(invoice, config, urls) {
    const base = config.production === "true"
      ? "https://connect.squareup.com"
      : "https://connect.squareupsandbox.com";
    const res = await fetch(`${base}/v2/online-checkout/payment-links`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.access_token}`,
        "Content-Type": "application/json",
        "Square-Version": "2024-01-18",
      },
      body: JSON.stringify({
        idempotency_key: invoice.id,
        quick_pay: {
          name: `Invoice #${invoice.number}`,
          price_money: {
            amount: Math.round(Number(invoice.total) * 100),
            currency: invoice.currency,
          },
          location_id: config.location_id,
        },
        checkout_options: { redirect_url: urls.success },
        payment_note: invoice.id,
      }),
    });
    if (!res.ok) throw new Error(`Square error: ${res.status}`);
    const data = await res.json();
    return { type: "redirect", url: data.payment_link.url as string };
  },
  async handleWebhook(request) {
    const body = (await request.json()) as {
      type?: string;
      data?: { object?: { payment?: { status?: string; note?: string; id?: string } } };
    };
    if (body.type !== "payment.updated") return null;
    const payment = body.data?.object?.payment;
    if (payment?.status !== "COMPLETED" || !payment.note) return null;
    return { invoiceId: payment.note, transactionId: String(payment.id ?? "square") };
  },
};
