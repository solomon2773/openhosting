import type { GatewayDriver } from "@/lib/extensions/types";

// Razorpay (India) — payment links; amounts in paise.
export const razorpayGateway: GatewayDriver = {
  slug: "razorpay",
  name: "Razorpay",
  configFields: [
    { key: "key_id", label: "Key ID", type: "text", required: true },
    { key: "key_secret", label: "Key secret", type: "password", required: true },
    { key: "webhook_secret", label: "Webhook secret", type: "password" },
  ],
  async pay(invoice, config, urls) {
    const auth = Buffer.from(`${config.key_id}:${config.key_secret}`).toString("base64");
    const res = await fetch("https://api.razorpay.com/v1/payment_links", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Math.round(Number(invoice.total) * 100),
        currency: invoice.currency,
        description: `Invoice #${invoice.number}`,
        reference_id: invoice.id,
        callback_url: urls.success,
        callback_method: "get",
        notes: { invoice_id: invoice.id },
      }),
    });
    if (!res.ok) throw new Error(`Razorpay error: ${res.status}`);
    const data = await res.json();
    return { type: "redirect", url: data.short_url as string };
  },
  async handleWebhook(request) {
    const event = (await request.json()) as {
      event?: string;
      payload?: { payment_link?: { entity?: { reference_id?: string; id?: string } } };
    };
    if (event.event !== "payment_link.paid") return null;
    const invoiceId = event.payload?.payment_link?.entity?.reference_id;
    if (!invoiceId) return null;
    return { invoiceId, transactionId: String(event.payload?.payment_link?.entity?.id ?? "razorpay") };
  },
};
