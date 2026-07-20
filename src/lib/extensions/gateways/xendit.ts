import type { GatewayDriver } from "@/lib/extensions/types";

// Xendit (SE Asia) — hosted invoice.
export const xenditGateway: GatewayDriver = {
  slug: "xendit",
  name: "Xendit (SE Asia)",
  configFields: [
    { key: "secret_key", label: "Secret API key", type: "password", required: true },
    { key: "webhook_token", label: "Webhook verification token", type: "password" },
  ],
  async pay(invoice, config, urls) {
    const auth = Buffer.from(`${config.secret_key}:`).toString("base64");
    const res = await fetch("https://api.xendit.co/v2/invoices", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        external_id: invoice.id,
        amount: Number(invoice.total),
        currency: invoice.currency,
        payer_email: invoice.user.email,
        description: `Invoice #${invoice.number}`,
        success_redirect_url: urls.success,
        failure_redirect_url: urls.cancel,
      }),
    });
    if (!res.ok) throw new Error(`Xendit error: ${res.status}`);
    const data = await res.json();
    return { type: "redirect", url: data.invoice_url as string };
  },
  async handleWebhook(request) {
    const body = (await request.json()) as {
      status?: string;
      external_id?: string;
      id?: string;
    };
    if (body.status !== "PAID" && body.status !== "SETTLED") return null;
    if (!body.external_id) return null;
    return { invoiceId: body.external_id, transactionId: String(body.id ?? "xendit") };
  },
};
