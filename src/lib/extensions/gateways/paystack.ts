import type { GatewayDriver } from "@/lib/extensions/types";

// Paystack (Africa) — initialize transaction, redirect to hosted page.
// Amounts are in the currency's subunit (kobo/pesewas/cents).
export const paystackGateway: GatewayDriver = {
  slug: "paystack",
  name: "Paystack",
  configFields: [
    { key: "secret_key", label: "Secret key", type: "password", required: true },
  ],
  async pay(invoice, config, urls) {
    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.secret_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: invoice.user.email,
        amount: Math.round(Number(invoice.total) * 100),
        currency: invoice.currency,
        reference: `oh_${invoice.id}`,
        callback_url: urls.success,
        metadata: { invoice_id: invoice.id },
      }),
    });
    if (!res.ok) throw new Error(`Paystack error: ${res.status}`);
    const data = await res.json();
    return { type: "redirect", url: data.data.authorization_url as string };
  },
  async handleWebhook(request) {
    const event = (await request.json()) as {
      event?: string;
      data?: { reference?: string; metadata?: { invoice_id?: string } };
    };
    if (event.event !== "charge.success") return null;
    const invoiceId = event.data?.metadata?.invoice_id;
    if (!invoiceId) return null;
    return { invoiceId, transactionId: String(event.data?.reference ?? "paystack") };
  },
};
