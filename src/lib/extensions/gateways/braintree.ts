import type { GatewayDriver } from "@/lib/extensions/types";

// Braintree (PayPal-owned). Braintree has no native hosted-redirect page, so
// this driver renders a Drop-in UI that tokenizes the card client-side and
// posts the nonce back to our capture route.
async function braintreeGraphQL(
  config: Record<string, string>,
  query: string,
  variables: Record<string, unknown>,
) {
  const base = config.production === "true"
    ? "https://payments.braintree-api.com/graphql"
    : "https://payments.sandbox.braintree-api.com/graphql";
  const auth = Buffer.from(`${config.public_key}:${config.private_key}`).toString("base64");
  const res = await fetch(base, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      "Braintree-Version": "2019-01-01",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Braintree error: ${res.status}`);
  return res.json();
}

export const braintreeGateway: GatewayDriver = {
  slug: "braintree",
  name: "Braintree",
  configFields: [
    { key: "merchant_id", label: "Merchant ID", type: "text", required: true },
    { key: "public_key", label: "Public key", type: "text", required: true },
    { key: "private_key", label: "Private key", type: "password", required: true },
    { key: "tokenization_key", label: "Tokenization key", type: "text", required: true, help: "Client-side key for the Drop-in UI" },
    { key: "production", label: "Production mode", type: "checkbox" },
  ],
  async pay(invoice, config, urls) {
    // Braintree Drop-in tokenizes client-side; our capture route
    // (/api/webhooks/braintree) receives the nonce and charges via GraphQL.
    return {
      type: "instructions",
      html: `
<div id="bt-dropin"></div>
<button id="bt-pay" class="btn-primary" style="margin-top:1rem">Pay ${Number(invoice.total).toFixed(2)} ${invoice.currency}</button>
<script src="https://js.braintreegateway.com/web/dropin/1.42.0/js/dropin.min.js"></script>
<script>
braintree.dropin.create({ authorization: ${JSON.stringify(config.tokenization_key)}, container: '#bt-dropin' }, function(err, instance){
  document.getElementById('bt-pay').addEventListener('click', function(){
    instance.requestPaymentMethod(function(e, payload){
      if (e) return;
      fetch('/api/webhooks/braintree', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ nonce: payload.nonce, invoice_id: ${JSON.stringify(invoice.id)} }) })
        .then(r => r.json()).then(function(res){ if (res.handled) window.location = ${JSON.stringify(urls.success)}; else alert('Payment failed'); });
    });
  });
});
</script>`,
    };
  },
  // Our capture route posts { nonce, invoice_id }; charge and confirm.
  async handleWebhook(request, config) {
    const body = (await request.json()) as { nonce?: string; invoice_id?: string; amount?: number };
    if (!body.nonce || !body.invoice_id) return null;
    const result = await braintreeGraphQL(
      config,
      `mutation($input: ChargePaymentMethodInput!) { chargePaymentMethod(input: $input) { transaction { id status } } }`,
      {
        input: {
          paymentMethodId: body.nonce,
          transaction: { amount: String(body.amount ?? 0) },
        },
      },
    );
    const status = result?.data?.chargePaymentMethod?.transaction?.status;
    if (status !== "SUBMITTED_FOR_SETTLEMENT" && status !== "SETTLED" && status !== "AUTHORIZED") {
      return null;
    }
    return {
      invoiceId: body.invoice_id,
      transactionId: String(result.data.chargePaymentMethod.transaction.id),
    };
  },
};
