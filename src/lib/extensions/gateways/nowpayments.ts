import type { GatewayDriver } from "@/lib/extensions/types";

// NOWPayments hosted invoice (crypto). API key auth; IPN confirms.
export const nowpaymentsGateway: GatewayDriver = {
  slug: "nowpayments",
  name: "NOWPayments (crypto)",
  configFields: [
    { key: "api_key", label: "API key", type: "password", required: true },
    { key: "ipn_secret", label: "IPN secret key", type: "password" },
  ],
  async pay(invoice, config, urls) {
    const res = await fetch("https://api.nowpayments.io/v1/invoice", {
      method: "POST",
      headers: {
        "x-api-key": config.api_key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        price_amount: Number(invoice.total),
        price_currency: invoice.currency.toLowerCase(),
        order_id: invoice.id,
        order_description: `Invoice #${invoice.number}`,
        ipn_callback_url: urls.webhook,
        success_url: urls.success,
        cancel_url: urls.cancel,
      }),
    });
    if (!res.ok) throw new Error(`NOWPayments error: ${res.status}`);
    const data = await res.json();
    return { type: "redirect", url: data.invoice_url as string };
  },
  async handleWebhook(request) {
    const body = (await request.json()) as {
      payment_status?: string;
      order_id?: string;
      payment_id?: string;
    };
    if (body.payment_status !== "finished" && body.payment_status !== "confirmed") {
      return null;
    }
    if (!body.order_id) return null;
    return { invoiceId: body.order_id, transactionId: String(body.payment_id ?? "nowpayments") };
  },
};
