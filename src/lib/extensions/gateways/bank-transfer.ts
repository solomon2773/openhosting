import type { GatewayDriver } from "@/lib/extensions/types";

// Manual/offline payments: shows wire instructions; an admin marks the
// invoice paid once the funds arrive.
export const bankTransferGateway: GatewayDriver = {
  slug: "bank-transfer",
  name: "Bank transfer",
  configFields: [
    {
      key: "instructions",
      label: "Payment instructions",
      type: "text",
      help: "Shown to the customer. Include your IBAN/account details and ask them to reference the invoice number.",
      required: true,
    },
  ],
  async pay(invoice, config) {
    return {
      type: "instructions",
      html: `<p>${config.instructions ?? ""}</p><p>Please include <strong>Invoice #${invoice.number}</strong> as the payment reference. Your services activate once we confirm the transfer.</p>`,
    };
  },
};
