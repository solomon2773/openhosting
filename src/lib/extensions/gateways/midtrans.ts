import type { GatewayDriver } from "@/lib/extensions/types";

// Midtrans (SE Asia / Indonesia) — Snap hosted checkout.
export const midtransGateway: GatewayDriver = {
  slug: "midtrans",
  name: "Midtrans (Indonesia)",
  configFields: [
    { key: "server_key", label: "Server key", type: "password", required: true },
    { key: "production", label: "Production mode", type: "checkbox" },
  ],
  async pay(invoice, config, urls) {
    const base = config.production === "true"
      ? "https://app.midtrans.com/snap/v1/transactions"
      : "https://app.sandbox.midtrans.com/snap/v1/transactions";
    const auth = Buffer.from(`${config.server_key}:`).toString("base64");
    const res = await fetch(base, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        transaction_details: {
          order_id: `oh-${invoice.id}`,
          // Midtrans IDR amounts must be integers
          gross_amount: Math.round(Number(invoice.total)),
        },
        customer_details: { email: invoice.user.email },
        callbacks: { finish: urls.success },
      }),
    });
    if (!res.ok) throw new Error(`Midtrans error: ${res.status}`);
    const data = await res.json();
    return { type: "redirect", url: data.redirect_url as string };
  },
  async handleWebhook(request) {
    const body = (await request.json()) as {
      transaction_status?: string;
      order_id?: string;
      transaction_id?: string;
    };
    const ok = body.transaction_status === "settlement" || body.transaction_status === "capture";
    if (!ok || !body.order_id) return null;
    return {
      invoiceId: body.order_id.replace(/^oh-/, ""),
      transactionId: String(body.transaction_id ?? "midtrans"),
    };
  },
};
