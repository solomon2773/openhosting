import type { GatewayDriver } from "@/lib/extensions/types";

// BTCPay Server (self-hosted). Greenfield API with an API key + store id.
export const btcpayGateway: GatewayDriver = {
  slug: "btcpay",
  name: "BTCPay Server (crypto)",
  configFields: [
    { key: "host", label: "BTCPay URL", type: "text", required: true, help: "e.g. https://btcpay.example.com" },
    { key: "store_id", label: "Store ID", type: "text", required: true },
    { key: "api_key", label: "API key", type: "password", required: true },
    { key: "webhook_secret", label: "Webhook secret", type: "password" },
  ],
  async pay(invoice, config, urls) {
    const base = config.host.replace(/\/$/, "");
    const res = await fetch(`${base}/api/v1/stores/${config.store_id}/invoices`, {
      method: "POST",
      headers: {
        Authorization: `token ${config.api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: Number(invoice.total).toFixed(2),
        currency: invoice.currency,
        metadata: { orderId: invoice.id, itemDesc: `Invoice #${invoice.number}` },
        checkout: { redirectURL: urls.success },
      }),
    });
    if (!res.ok) throw new Error(`BTCPay error: ${res.status}`);
    const data = await res.json();
    return { type: "redirect", url: data.checkoutLink as string };
  },
  async handleWebhook(request) {
    const event = (await request.json()) as {
      type?: string;
      invoiceId?: string;
      metadata?: { orderId?: string };
    };
    if (event.type !== "InvoiceSettled" && event.type !== "InvoicePaymentSettled") {
      return null;
    }
    const invoiceId = event.metadata?.orderId;
    if (!invoiceId) return null;
    return { invoiceId, transactionId: String(event.invoiceId ?? "btcpay") };
  },
};
