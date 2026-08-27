import { canonicalJson, toAtomicUnits } from "@/lib/agent-commerce-policy";

type X402Invoice = {
  number: number;
  total: number | string | { toString(): string };
  currency: string;
};

export type X402Config = {
  facilitator_url: string;
  network: string;
  asset: string;
  pay_to: string;
  authorization_token?: string;
  max_timeout_seconds?: string;
};

export type X402Requirements = {
  scheme: "exact";
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: { name: "USDC"; version: "2" };
};

export type X402PaymentRequired = {
  x402Version: 2;
  error?: string;
  resource: {
    url: string;
    description: string;
    mimeType: "application/json";
    serviceName: "OpenHosting";
    tags: ["hosting", "invoice"];
  };
  accepts: X402Requirements[];
  extensions: Record<string, never>;
};

export function validateX402Config(config: X402Config): string | null {
  try {
    const facilitator = new URL(config.facilitator_url);
    if (facilitator.protocol !== "https:" && facilitator.hostname !== "localhost") {
      return "Facilitator URL must use HTTPS.";
    }
  } catch {
    return "Facilitator URL is invalid.";
  }
  if (!/^[a-z0-9-]+:[A-Za-z0-9]+$/.test(config.network)) {
    return "Network must be a CAIP-2 identifier.";
  }
  if (!config.asset || !config.pay_to) return "Asset and receiving address are required.";
  const timeout = Number(config.max_timeout_seconds || 60);
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 3_600) {
    return "Payment timeout must be between 1 and 3600 seconds.";
  }
  return null;
}

export function x402Requirements(
  invoice: Pick<X402Invoice, "total" | "currency">,
  config: X402Config,
): X402Requirements {
  if (invoice.currency !== "USDC") {
    throw new Error("x402 requires a USDC invoice");
  }
  const configError = validateX402Config(config);
  if (configError) throw new Error(configError);
  return {
    scheme: "exact",
    network: config.network,
    amount: toAtomicUnits(invoice.total, 6),
    asset: config.asset,
    payTo: config.pay_to,
    maxTimeoutSeconds: Number(config.max_timeout_seconds || 60),
    extra: { name: "USDC", version: "2" },
  };
}

export function x402PaymentRequired(input: {
  invoice: X402Invoice;
  config: X402Config;
  resourceUrl: string;
  error?: string;
}): X402PaymentRequired {
  return {
    x402Version: 2,
    ...(input.error ? { error: input.error } : {}),
    resource: {
      url: input.resourceUrl,
      description: `Settle OpenHosting invoice #${input.invoice.number}`,
      mimeType: "application/json",
      serviceName: "OpenHosting",
      tags: ["hosting", "invoice"],
    },
    accepts: [x402Requirements(input.invoice, input.config)],
    extensions: {},
  };
}

export function encodeX402Header(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

export function decodeX402Header(value: string): Record<string, unknown> {
  if (!value || value.length > 65_536 || !/^[A-Za-z0-9+/=_-]+$/.test(value)) {
    throw new Error("Invalid PAYMENT-SIGNATURE header");
  }
  const decoded = Buffer.from(value, "base64").toString("utf8");
  const parsed: unknown = JSON.parse(decoded);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid x402 payment payload");
  }
  return parsed as Record<string, unknown>;
}

export function paymentPayloadMatches(
  payload: Record<string, unknown>,
  resourceUrl: string,
  requirements: X402Requirements,
): boolean {
  if (payload.x402Version !== 2) return false;
  const resource = payload.resource as Record<string, unknown> | undefined;
  if (!resource || resource.url !== resourceUrl) return false;
  return canonicalJson(payload.accepted) === canonicalJson(requirements);
}

async function facilitatorCall(
  config: X402Config,
  path: "verify" | "settle",
  paymentPayload: Record<string, unknown>,
  paymentRequirements: X402Requirements,
): Promise<Record<string, unknown>> {
  const url = new URL(path, `${config.facilitator_url.replace(/\/+$/, "")}/`);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.authorization_token
        ? { Authorization: `Bearer ${config.authorization_token}` }
        : {}),
    },
    body: JSON.stringify({ x402Version: 2, paymentPayload, paymentRequirements }),
    signal: AbortSignal.timeout(15_000),
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || !body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error(`Facilitator ${path} failed with HTTP ${response.status}`);
  }
  return body as Record<string, unknown>;
}

export async function verifyAndSettleX402(input: {
  config: X402Config;
  paymentPayload: Record<string, unknown>;
  paymentRequirements: X402Requirements;
}) {
  const verified = await facilitatorCall(
    input.config,
    "verify",
    input.paymentPayload,
    input.paymentRequirements,
  );
  if (verified.isValid !== true) {
    throw new Error(
      typeof verified.invalidReason === "string"
        ? verified.invalidReason
        : "Facilitator rejected the payment authorization",
    );
  }
  const settled = await facilitatorCall(
    input.config,
    "settle",
    input.paymentPayload,
    input.paymentRequirements,
  );
  if (
    settled.success !== true ||
    typeof settled.transaction !== "string" ||
    !settled.transaction ||
    settled.network !== input.paymentRequirements.network ||
    (settled.amount !== undefined && settled.amount !== input.paymentRequirements.amount)
  ) {
    throw new Error(
      typeof settled.errorReason === "string"
        ? settled.errorReason
        : "Facilitator did not confirm an exact settlement",
    );
  }
  return {
    success: true as const,
    transaction: settled.transaction,
    network: String(settled.network),
    payer: typeof settled.payer === "string" ? settled.payer : undefined,
    amount: input.paymentRequirements.amount,
    ...(settled.extensions && typeof settled.extensions === "object"
      ? { extensions: settled.extensions }
      : {}),
  };
}
