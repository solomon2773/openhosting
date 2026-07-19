import type { GatewayDriver } from "@/lib/extensions/types";

// Stripe via the REST API — no SDK dependency needed.
async function stripeRequest(
  secretKey: string,
  path: string,
  params?: Record<string, string>,
  method: "POST" | "GET" = "POST",
) {
  const query =
    method === "GET" && params ? `?${new URLSearchParams(params)}` : "";
  const res = await fetch(`https://api.stripe.com/v1${path}${query}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(method === "POST"
        ? { "Content-Type": "application/x-www-form-urlencoded" }
        : {}),
    },
    body: method === "POST" && params ? new URLSearchParams(params) : undefined,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Stripe API error ${res.status}: ${body}`);
  }
  return res.json();
}

export const stripeGateway: GatewayDriver = {
  slug: "stripe",
  name: "Stripe",
  configFields: [
    { key: "secret_key", label: "Secret key", type: "password", required: true },
    {
      key: "webhook_secret",
      label: "Webhook signing secret",
      type: "password",
      help: "From the Stripe dashboard webhook endpoint (checkout.session.completed).",
    },
  ],
  async pay(invoice, config, urls) {
    const session = await stripeRequest(config.secret_key, "/checkout/sessions", {
      mode: "payment",
      "line_items[0][price_data][currency]": invoice.currency.toLowerCase(),
      "line_items[0][price_data][product_data][name]": `Invoice #${invoice.number}`,
      "line_items[0][price_data][unit_amount]": String(
        Math.round(Number(invoice.total) * 100),
      ),
      "line_items[0][quantity]": "1",
      customer_email: invoice.user.email,
      client_reference_id: invoice.id,
      "metadata[invoice_id]": invoice.id,
      success_url: urls.success,
      cancel_url: urls.cancel,
    });
    return { type: "redirect", url: session.url as string };
  },
  async handleWebhook(request) {
    // Signature verification is done in the webhook route (needs the raw body).
    const event = (await request.json()) as {
      type: string;
      data: { object: { id: string; metadata?: { invoice_id?: string } } };
    };
    if (event.type !== "checkout.session.completed") return null;
    const invoiceId = event.data.object.metadata?.invoice_id;
    if (!invoiceId) return null;
    return { invoiceId, transactionId: event.data.object.id };
  },

  // ── Stored payment methods / auto-charge ──────────────────────────────────

  async createSetupRedirect(user, existingCustomerId, config, urls) {
    const customerId =
      existingCustomerId ??
      (
        await stripeRequest(config.secret_key, "/customers", {
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          "metadata[user_id]": user.id,
        })
      ).id;
    const session = await stripeRequest(config.secret_key, "/checkout/sessions", {
      mode: "setup",
      customer: customerId,
      "payment_method_types[0]": "card",
      success_url: `${urls.success}${urls.success.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: urls.cancel,
    });
    return { url: session.url as string };
  },

  async completeSetup(sessionRef, config) {
    const session = await stripeRequest(
      config.secret_key,
      `/checkout/sessions/${encodeURIComponent(sessionRef)}`,
      { "expand[]": "setup_intent" },
      "GET",
    );
    const methodId = session.setup_intent?.payment_method;
    const customerId = session.customer;
    if (!methodId || !customerId) return null;
    const method = await stripeRequest(
      config.secret_key,
      `/payment_methods/${methodId}`,
      undefined,
      "GET",
    );
    return {
      customerId: String(customerId),
      methodId: String(methodId),
      brand: method.card?.brand,
      last4: method.card?.last4,
      expMonth: method.card?.exp_month,
      expYear: method.card?.exp_year,
    };
  },

  async chargeStored(invoice, method, config) {
    const intent = await stripeRequest(config.secret_key, "/payment_intents", {
      amount: String(Math.round(Number(invoice.total) * 100)),
      currency: invoice.currency.toLowerCase(),
      customer: method.customerId,
      payment_method: method.methodId,
      off_session: "true",
      confirm: "true",
      description: `Invoice #${invoice.number}`,
      "metadata[invoice_id]": invoice.id,
    });
    if (intent.status !== "succeeded") return null;
    return { transactionId: intent.id as string };
  },
};
