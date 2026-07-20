import type { GatewayDriver } from "@/lib/extensions/types";

// Authorize.net — hosted payment page (Accept Hosted). We request a form
// token, then auto-submit the customer to the hosted form.
export const authorizeNetGateway: GatewayDriver = {
  slug: "authorizenet",
  name: "Authorize.net",
  configFields: [
    { key: "login_id", label: "API login ID", type: "text", required: true },
    { key: "transaction_key", label: "Transaction key", type: "password", required: true },
    { key: "signature_key", label: "Signature key", type: "password", help: "For webhook verification" },
    { key: "sandbox", label: "Sandbox mode", type: "checkbox" },
  ],
  async pay(invoice, config, urls) {
    const endpoint = config.sandbox === "true"
      ? "https://apitest.authorize.net/xml/v1/request.api"
      : "https://api.authorize.net/xml/v1/request.api";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        getHostedPaymentPageRequest: {
          merchantAuthentication: {
            name: config.login_id,
            transactionKey: config.transaction_key,
          },
          transactionRequest: {
            transactionType: "authCaptureTransaction",
            amount: Number(invoice.total).toFixed(2),
            order: { invoiceNumber: String(invoice.number), description: invoice.id },
          },
          hostedPaymentSettings: {
            setting: [
              { settingName: "hostedPaymentReturnOptions", settingValue: JSON.stringify({ url: urls.success, cancelUrl: urls.cancel, showReceipt: true }) },
              { settingName: "hostedPaymentButtonOptions", settingValue: JSON.stringify({ text: "Pay" }) },
            ],
          },
        },
      }),
    });
    if (!res.ok) throw new Error(`Authorize.net error: ${res.status}`);
    // response is JSON but served with a BOM; strip it
    const text = (await res.text()).replace(/^﻿/, "");
    const data = JSON.parse(text);
    const token = data.token as string | undefined;
    if (!token) throw new Error("Authorize.net did not return a form token");
    const formUrl = config.sandbox === "true"
      ? "https://test.authorize.net/payment/payment"
      : "https://accept.authorize.net/payment/payment";
    // hosted page requires a POST; return a self-submitting form as instructions
    return {
      type: "instructions",
      html: `<form id="anet" method="post" action="${formUrl}"><input type="hidden" name="token" value="${token}"/></form><script>document.getElementById('anet').submit()</script><p>Redirecting to Authorize.net…</p>`,
    };
  },
  async handleWebhook(request) {
    const body = (await request.json()) as {
      eventType?: string;
      payload?: { invoiceNumber?: string; id?: string; description?: string };
    };
    if (body.eventType !== "net.authorize.payment.authcapture.created") return null;
    // description carries our invoice id
    const invoiceId = body.payload?.description;
    if (!invoiceId) return null;
    return { invoiceId, transactionId: String(body.payload?.id ?? "authorizenet") };
  },
};
