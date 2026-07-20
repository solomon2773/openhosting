import type { GatewayDriver } from "@/lib/extensions/types";

// Flutterwave (Africa) — Standard hosted payment link.
export const flutterwaveGateway: GatewayDriver = {
  slug: "flutterwave",
  name: "Flutterwave",
  configFields: [
    { key: "secret_key", label: "Secret key", type: "password", required: true },
  ],
  async pay(invoice, config, urls) {
    const res = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.secret_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tx_ref: `oh_${invoice.id}`,
        amount: Number(invoice.total),
        currency: invoice.currency,
        redirect_url: urls.success,
        customer: { email: invoice.user.email, name: `${invoice.user.firstName} ${invoice.user.lastName}` },
        meta: { invoice_id: invoice.id },
      }),
    });
    if (!res.ok) throw new Error(`Flutterwave error: ${res.status}`);
    const data = await res.json();
    return { type: "redirect", url: data.data.link as string };
  },
  async handleWebhook(request) {
    const event = (await request.json()) as {
      event?: string;
      data?: { status?: string; tx_ref?: string; id?: number; meta?: { invoice_id?: string } };
    };
    if (event.data?.status !== "successful") return null;
    const invoiceId = event.data?.meta?.invoice_id ?? event.data?.tx_ref?.replace(/^oh_/, "");
    if (!invoiceId) return null;
    return { invoiceId, transactionId: String(event.data?.id ?? "flutterwave") };
  },
};
