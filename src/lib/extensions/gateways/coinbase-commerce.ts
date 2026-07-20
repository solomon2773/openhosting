import type { GatewayDriver } from "@/lib/extensions/types";

// Coinbase Commerce hosted checkout (crypto). API key auth; webhook confirms.
export const coinbaseCommerceGateway: GatewayDriver = {
  slug: "coinbase-commerce",
  name: "Coinbase Commerce (crypto)",
  configFields: [
    { key: "api_key", label: "API key", type: "password", required: true },
    { key: "webhook_shared_secret", label: "Webhook shared secret", type: "password", help: "From Settings → Webhook subscriptions" },
  ],
  async pay(invoice, config, urls) {
    const res = await fetch("https://api.commerce.coinbase.com/charges", {
      method: "POST",
      headers: {
        "X-CC-Api-Key": config.api_key,
        "X-CC-Version": "2018-03-22",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `Invoice #${invoice.number}`,
        description: `Invoice #${invoice.number}`,
        pricing_type: "fixed_price",
        local_price: {
          amount: Number(invoice.total).toFixed(2),
          currency: invoice.currency,
        },
        metadata: { invoice_id: invoice.id },
        redirect_url: urls.success,
        cancel_url: urls.cancel,
      }),
    });
    if (!res.ok) throw new Error(`Coinbase Commerce error: ${res.status}`);
    const data = await res.json();
    return { type: "redirect", url: data.data.hosted_url as string };
  },
  async handleWebhook(request) {
    const event = (await request.json()) as {
      event?: { type: string; data: { id: string; metadata?: { invoice_id?: string } } };
    };
    if (event.event?.type !== "charge:confirmed") return null;
    const invoiceId = event.event.data.metadata?.invoice_id;
    if (!invoiceId) return null;
    return { invoiceId, transactionId: event.event.data.id };
  },
};
