import type { GatewayDriver } from "@/lib/extensions/types";

// CoinGate hosted checkout (crypto). Token auth; callback confirms.
export const coingateGateway: GatewayDriver = {
  slug: "coingate",
  name: "CoinGate (crypto)",
  configFields: [
    { key: "auth_token", label: "API auth token", type: "password", required: true },
    { key: "sandbox", label: "Sandbox mode", type: "checkbox" },
  ],
  async pay(invoice, config, urls) {
    const base = config.sandbox === "true"
      ? "https://api-sandbox.coingate.com/v2"
      : "https://api.coingate.com/v2";
    const res = await fetch(`${base}/orders`, {
      method: "POST",
      headers: {
        Authorization: `Token ${config.auth_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        order_id: invoice.id,
        price_amount: Number(invoice.total).toFixed(2),
        price_currency: invoice.currency,
        receive_currency: "DO_NOT_CONVERT",
        title: `Invoice #${invoice.number}`,
        callback_url: urls.webhook,
        success_url: urls.success,
        cancel_url: urls.cancel,
      }),
    });
    if (!res.ok) throw new Error(`CoinGate error: ${res.status}`);
    const data = await res.json();
    return { type: "redirect", url: data.payment_url as string };
  },
  async handleWebhook(request) {
    const form = await request.formData().catch(() => null);
    if (!form) return null;
    if (form.get("status") !== "paid") return null;
    const invoiceId = form.get("order_id");
    if (!invoiceId) return null;
    return { invoiceId: String(invoiceId), transactionId: String(form.get("id") ?? "coingate") };
  },
};
