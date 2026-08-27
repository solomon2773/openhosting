import type { BillingCycle } from "@/generated/prisma/client";

export function formatMoney(
  amount: number | string | { toString(): string },
  currency = "USD",
): string {
  const numericAmount = Number(amount.toString());
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(numericAmount);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    const formatted = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: currency === "USDC" ? 6 : 8,
    }).format(numericAmount);
    return `${formatted} ${currency}`;
  }
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export const CYCLE_LABELS: Record<BillingCycle, string> = {
  ONE_TIME: "One-time",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  SEMI_ANNUALLY: "Semi-annually",
  ANNUALLY: "Annually",
  BIENNIALLY: "Biennially",
};

export const CYCLE_MONTHS: Record<BillingCycle, number> = {
  ONE_TIME: 0,
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMI_ANNUALLY: 6,
  ANNUALLY: 12,
  BIENNIALLY: 24,
};

export function addCycle(date: Date, cycle: BillingCycle): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + CYCLE_MONTHS[cycle]);
  return next;
}
