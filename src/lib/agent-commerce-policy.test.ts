import { describe, expect, test } from "vitest";
import {
  canonicalJson,
  toAtomicUnits,
  validateDelegatedPurchase,
} from "@/lib/agent-commerce-policy";

const activeGrant = {
  allowedProductIds: ["product-a"],
  allowedCurrencies: ["USD", "USDC"],
  maxPerOrderBase: 50,
  spendLimitBase: 100,
  committedBase: 25,
  expiresAt: new Date("2027-01-01T00:00:00Z"),
  revokedAt: null,
};

describe("delegated purchase policy", () => {
  test("accepts purchases inside every delegated boundary", () => {
    expect(
      validateDelegatedPurchase(
        activeGrant,
        { productIds: ["product-a"], currency: "USDC", baseAmount: 50 },
        new Date("2026-08-27T00:00:00Z"),
      ),
    ).toBeNull();
  });

  test("rejects products, currencies, per-order spend, and aggregate spend", () => {
    const now = new Date("2026-08-27T00:00:00Z");
    expect(
      validateDelegatedPurchase(
        activeGrant,
        { productIds: ["product-b"], currency: "USD", baseAmount: 1 },
        now,
      ),
    ).toMatch(/products/);
    expect(
      validateDelegatedPurchase(
        activeGrant,
        { productIds: ["product-a"], currency: "EUR", baseAmount: 1 },
        now,
      ),
    ).toMatch(/currency/);
    expect(
      validateDelegatedPurchase(
        activeGrant,
        { productIds: ["product-a"], currency: "USD", baseAmount: 51 },
        now,
      ),
    ).toMatch(/per-order/);
    expect(
      validateDelegatedPurchase(
        { ...activeGrant, committedBase: 60 },
        { productIds: ["product-a"], currency: "USD", baseAmount: 50 },
        now,
      ),
    ).toMatch(/total spend/);
  });
});

describe("protocol primitives", () => {
  test("canonicalizes object keys for stable idempotency hashes", () => {
    expect(canonicalJson({ z: 1, a: { y: 2, x: 3 } })).toBe(
      '{"a":{"x":3,"y":2},"z":1}',
    );
  });

  test("converts USDC amounts to six-decimal atomic units", () => {
    expect(toAtomicUnits("1.010000", 6)).toBe("1010000");
    expect(toAtomicUnits("0.000001", 6)).toBe("1");
    expect(() => toAtomicUnits("0.0000011", 6)).toThrow(/precision/);
  });
});
