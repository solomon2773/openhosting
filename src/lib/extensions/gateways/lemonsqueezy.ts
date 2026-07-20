import type { GatewayDriver } from "@/lib/extensions/types";

// Lemon Squeezy — merchant of record (handles global tax). Uses a dynamic
// checkout with a custom price override on a configured variant.
export const lemonSqueezyGateway: GatewayDriver = {
  slug: "lemonsqueezy",
  name: "Lemon Squeezy (merchant of record)",
  configFields: [
    { key: "api_key", label: "API key", type: "password", required: true },
    { key: "store_id", label: "Store ID", type: "text", required: true },
    { key: "variant_id", label: "Variant ID", type: "text", required: true, help: "A 'pay what you want' product variant used for dynamic pricing." },
    { key: "signing_secret", label: "Webhook signing secret", type: "password" },
  ],
  async pay(invoice, config, urls) {
    const res = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.api_key}`,
        "Content-Type": "application/vnd.api+json",
        Accept: "application/vnd.api+json",
      },
      body: JSON.stringify({
        data: {
          type: "checkouts",
          attributes: {
            custom_price: Math.round(Number(invoice.total) * 100),
            checkout_data: {
              email: invoice.user.email,
              custom: { invoice_id: invoice.id },
            },
            product_options: { redirect_url: urls.success },
          },
          relationships: {
            store: { data: { type: "stores", id: String(config.store_id) } },
            variant: { data: { type: "variants", id: String(config.variant_id) } },
          },
        },
      }),
    });
    if (!res.ok) throw new Error(`Lemon Squeezy error: ${res.status}`);
    const data = await res.json();
    return { type: "redirect", url: data.data.attributes.url as string };
  },
  async handleWebhook(request) {
    const event = (await request.json()) as {
      meta?: { event_name?: string; custom_data?: { invoice_id?: string } };
      data?: { id?: string };
    };
    if (event.meta?.event_name !== "order_created") return null;
    const invoiceId = event.meta?.custom_data?.invoice_id;
    if (!invoiceId) return null;
    return { invoiceId, transactionId: String(event.data?.id ?? "lemonsqueezy") };
  },
};
