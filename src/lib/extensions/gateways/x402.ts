import type { GatewayDriver } from "@/lib/extensions/types";

export const x402Gateway: GatewayDriver = {
  slug: "x402",
  name: "x402 (USDC)",
  supportedCurrencies: ["USDC"],
  configFields: [
    {
      key: "facilitator_url",
      label: "Facilitator URL",
      type: "text",
      required: true,
      help: "Base URL of an x402 v2 facilitator. Use testnet before mainnet.",
    },
    {
      key: "authorization_token",
      label: "Facilitator bearer token",
      type: "password",
      help: "Optional static bearer credential. Never use a wallet private key here.",
    },
    {
      key: "network",
      label: "CAIP-2 network",
      type: "text",
      required: true,
      help: "For example eip155:8453 for Base mainnet.",
    },
    {
      key: "asset",
      label: "USDC asset identifier",
      type: "text",
      required: true,
      help: "The official USDC contract or mint for the selected network.",
    },
    {
      key: "pay_to",
      label: "Receiving wallet address",
      type: "text",
      required: true,
    },
    {
      key: "max_timeout_seconds",
      label: "Payment timeout (seconds)",
      type: "text",
      help: "Defaults to 60; maximum 3600.",
    },
  ],
  async pay(invoice, _config, urls) {
    if (invoice.currency !== "USDC") {
      throw new Error("x402 is only available for USDC invoices");
    }
    const endpoint = urls.webhook.replace(
      /\/api\/webhooks\/x402$/,
      `/api/x402/invoices/${invoice.id}`,
    );
    return {
      type: "instructions",
      html: `<p>Use an x402 v2 wallet client to POST payment to <code>${endpoint}</code>. The endpoint returns the exact signed-payment requirements.</p>`,
    };
  },
};
