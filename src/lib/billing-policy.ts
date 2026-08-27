import type { BillingCycle } from "@/generated/prisma/client";
import { CYCLE_MONTHS } from "@/lib/format";

const DAY_MS = 86_400_000;

export type OrderTotalsLine = {
  productId: string;
  lineTotal: number;
};

export type ApplicableCoupon = {
  type: "PERCENT" | "FIXED";
  value: number;
  productIds: string[];
};

export type CouponAvailability = {
  expiresAt: Date | null;
  maxUses: number | null;
  uses: number;
};

export function roundCurrency(amount: number): number {
  return roundAsset(amount, 2);
}

export function roundAsset(amount: number, decimals: number): number {
  const precision = Math.min(8, Math.max(0, Math.trunc(decimals)));
  const factor = 10 ** precision;
  return Math.round((amount + Number.EPSILON) * factor) / factor;
}

export function isCouponAvailable(
  coupon: CouponAvailability,
  now: Date,
): boolean {
  if (coupon.expiresAt && coupon.expiresAt < now) return false;
  return coupon.maxUses === null || coupon.uses < coupon.maxUses;
}

export function calculateOrderTotals(
  lines: OrderTotalsLine[],
  coupon: ApplicableCoupon | null,
  taxRatePercent: number | null,
  currencyRate = 1,
  currencyDecimals = 2,
) {
  const subtotal = roundCurrency(
    lines.reduce((sum, line) => sum + line.lineTotal, 0),
  );

  let discount = 0;
  if (coupon) {
    const eligible =
      coupon.productIds.length === 0
        ? subtotal
        : roundCurrency(
            lines
              .filter((line) => coupon.productIds.includes(line.productId))
              .reduce((sum, line) => sum + line.lineTotal, 0),
          );
    discount =
      coupon.type === "PERCENT"
        ? roundCurrency((eligible * coupon.value) / 100)
        : Math.min(roundCurrency(coupon.value), eligible);
  }

  const tax =
    taxRatePercent === null
      ? 0
      : roundCurrency(((subtotal - discount) * taxRatePercent) / 100);

  return {
    subtotal: roundAsset(subtotal * currencyRate, currencyDecimals),
    discount: roundAsset(discount * currencyRate, currencyDecimals),
    tax: roundAsset(tax * currencyRate, currencyDecimals),
    total: roundAsset(
      (subtotal - discount + tax) * currencyRate,
      currencyDecimals,
    ),
  };
}

export function renewalInvoiceHorizon(now: Date, daysBefore: number): Date {
  return new Date(now.getTime() + daysBefore * DAY_MS);
}

export function lifecycleCutoff(now: Date, elapsedDays: number): Date {
  return new Date(now.getTime() - elapsedDays * DAY_MS);
}

export function calculateProratedUpgradeCharge(input: {
  currentPrice: number;
  newPrice: number;
  expiresAt: Date | null;
  cycle: BillingCycle;
  now: Date;
}): number {
  const difference = input.newPrice - input.currentPrice;
  if (
    difference <= 0 ||
    !input.expiresAt ||
    input.cycle === "ONE_TIME"
  ) {
    return 0;
  }

  const cycleDays = CYCLE_MONTHS[input.cycle] * 30.44;
  const remainingDays = Math.max(
    0,
    (input.expiresAt.getTime() - input.now.getTime()) / DAY_MS,
  );
  const remainingFraction = Math.min(1, remainingDays / cycleDays);

  return roundCurrency(difference * remainingFraction);
}
