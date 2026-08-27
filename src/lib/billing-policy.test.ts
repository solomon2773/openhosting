import { describe, expect, test } from "vitest";
import {
  calculateOrderTotals,
  calculateProratedUpgradeCharge,
  isCouponAvailable,
  lifecycleCutoff,
  renewalInvoiceHorizon,
} from "@/lib/billing-policy";

describe("order totals", () => {
  test("applies a product-restricted percentage coupon before tax and conversion", () => {
    const totals = calculateOrderTotals(
      [
        { productId: "hosting", lineTotal: 100 },
        { productId: "domain", lineTotal: 50 },
      ],
      { type: "PERCENT", value: 10, productIds: ["hosting"] },
      5,
      0.9,
    );

    expect(totals).toEqual({
      subtotal: 135,
      discount: 9,
      tax: 6.3,
      total: 132.3,
    });
  });

  test("caps a fixed coupon at the eligible product total", () => {
    const totals = calculateOrderTotals(
      [
        { productId: "hosting", lineTotal: 100 },
        { productId: "domain", lineTotal: 20 },
      ],
      { type: "FIXED", value: 75, productIds: ["domain"] },
      null,
    );

    expect(totals).toEqual({
      subtotal: 120,
      discount: 20,
      tax: 0,
      total: 100,
    });
  });

  test("rounds in base currency and converts only the final components", () => {
    const totals = calculateOrderTotals(
      [
        { productId: "a", lineTotal: 10.005 },
        { productId: "b", lineTotal: 0.004 },
      ],
      null,
      8.25,
      1.234567,
    );

    expect(totals).toEqual({
      subtotal: 12.36,
      discount: 0,
      tax: 1.02,
      total: 13.38,
    });
  });

  test("preserves USDC's six-decimal precision", () => {
    const totals = calculateOrderTotals(
      [{ productId: "metered", lineTotal: 1.2345674 }],
      null,
      null,
      1,
      6,
    );

    expect(totals).toEqual({
      subtotal: 1.23,
      discount: 0,
      tax: 0,
      total: 1.23,
    });
  });

  test("supports sub-cent converted totals for six-decimal assets", () => {
    const totals = calculateOrderTotals(
      [{ productId: "metered", lineTotal: 0.01 }],
      null,
      null,
      0.12345678,
      6,
    );

    expect(totals.total).toBe(0.001235);
  });
});

describe("coupon availability", () => {
  const now = new Date("2026-08-27T12:00:00.000Z");

  test("accepts a coupon at its exact expiry instant", () => {
    expect(
      isCouponAvailable({ expiresAt: now, maxUses: null, uses: 50 }, now),
    ).toBe(true);
  });

  test("rejects expired and exhausted coupons", () => {
    expect(
      isCouponAvailable(
        {
          expiresAt: new Date(now.getTime() - 1),
          maxUses: null,
          uses: 0,
        },
        now,
      ),
    ).toBe(false);
    expect(
      isCouponAvailable({ expiresAt: null, maxUses: 2, uses: 2 }, now),
    ).toBe(false);
  });
});

describe("renewal and lifecycle dates", () => {
  const now = new Date("2026-08-27T12:00:00.000Z");

  test("calculates an inclusive renewal horizon from an injected clock", () => {
    expect(renewalInvoiceHorizon(now, 14).toISOString()).toBe(
      "2026-09-10T12:00:00.000Z",
    );
  });

  test("calculates suspension and cancellation cutoffs from the same clock", () => {
    expect(lifecycleCutoff(now, 3).toISOString()).toBe(
      "2026-08-24T12:00:00.000Z",
    );
    expect(lifecycleCutoff(now, 0)).toEqual(now);
  });
});

describe("upgrade proration", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");

  test("charges only for the remaining fraction of a billing cycle", () => {
    const expiresAt = new Date(
      now.getTime() + (12 * 30.44 * 86_400_000) / 2,
    );

    expect(
      calculateProratedUpgradeCharge({
        currentPrice: 120,
        newPrice: 240,
        expiresAt,
        cycle: "ANNUALLY",
        now,
      }),
    ).toBe(60);
  });

  test("caps the fraction at one cycle", () => {
    const expiresAt = new Date(now);
    expiresAt.setFullYear(expiresAt.getFullYear() + 2);

    expect(
      calculateProratedUpgradeCharge({
        currentPrice: 10,
        newPrice: 25,
        expiresAt,
        cycle: "MONTHLY",
        now,
      }),
    ).toBe(15);
  });

  test("does not charge for downgrades, expired periods, or one-time services", () => {
    expect(
      calculateProratedUpgradeCharge({
        currentPrice: 25,
        newPrice: 10,
        expiresAt: new Date(now.getTime() + 86_400_000),
        cycle: "MONTHLY",
        now,
      }),
    ).toBe(0);
    expect(
      calculateProratedUpgradeCharge({
        currentPrice: 10,
        newPrice: 25,
        expiresAt: new Date(now.getTime() - 1),
        cycle: "MONTHLY",
        now,
      }),
    ).toBe(0);
    expect(
      calculateProratedUpgradeCharge({
        currentPrice: 10,
        newPrice: 25,
        expiresAt: null,
        cycle: "ONE_TIME",
        now,
      }),
    ).toBe(0);
  });
});
