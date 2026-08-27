export const ACP_VERSION = "2026-04-17";

export type AgentGrantLimits = {
  allowedProductIds: unknown;
  allowedCurrencies: unknown;
  maxPerOrderBase: number;
  spendLimitBase: number;
  committedBase: number;
  expiresAt: Date | null;
  revokedAt: Date | null;
};

export function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

export function validateDelegatedPurchase(
  grant: AgentGrantLimits,
  input: { productIds: string[]; currency: string; baseAmount: number },
  now: Date,
): string | null {
  if (grant.revokedAt) return "The purchasing grant has been revoked.";
  if (grant.expiresAt && grant.expiresAt <= now) {
    return "The purchasing grant has expired.";
  }

  const products = new Set(stringList(grant.allowedProductIds));
  if (input.productIds.some((productId) => !products.has(productId))) {
    return "The purchasing grant does not allow one or more products.";
  }

  const currencies = new Set(
    stringList(grant.allowedCurrencies).map((code) => code.toUpperCase()),
  );
  if (!currencies.has(input.currency.toUpperCase())) {
    return "The purchasing grant does not allow this currency.";
  }

  if (input.baseAmount <= 0 || !Number.isFinite(input.baseAmount)) {
    return "The order amount must be greater than zero.";
  }
  if (input.baseAmount > grant.maxPerOrderBase) {
    return "The order exceeds the grant's per-order limit.";
  }
  if (grant.committedBase + input.baseAmount > grant.spendLimitBase) {
    return "The order exceeds the grant's total spend limit.";
  }
  return null;
}

export function toAtomicUnits(
  amount: number | string | { toString(): string },
  decimals: number,
): string {
  const precision = Math.min(8, Math.max(0, Math.trunc(decimals)));
  const raw = amount.toString();
  if (!/^\d+(?:\.\d+)?$/.test(raw)) {
    throw new Error("Amount must be a non-negative decimal value");
  }
  const [whole, fraction = ""] = raw.split(".");
  const discarded = fraction.slice(precision);
  if (discarded && /[1-9]/.test(discarded)) {
    throw new Error(`Amount exceeds ${precision}-decimal asset precision`);
  }
  const padded = fraction.slice(0, precision).padEnd(precision, "0");
  return (BigInt(whole) * 10n ** BigInt(precision) + BigInt(padded || "0")).toString();
}
