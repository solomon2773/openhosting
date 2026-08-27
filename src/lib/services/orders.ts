import "server-only";
import type { BillingCycle } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  calculateOrderTotals,
  isCouponAvailable,
  roundAsset,
  roundCurrency,
} from "@/lib/billing-policy";
import { CYCLE_MONTHS } from "@/lib/format";
import { getSettings } from "@/lib/settings";

type CheckoutCurrency = { code: string; rate: number; decimals?: number };

// Order service: turns a cart into an order + invoice + pending services,
// applying coupons and taxes. The only module that computes checkout math.

export type CartLine = {
  productId: string;
  cycle: BillingCycle;
  quantity: number;
  // chosen config option value ids
  optionValues: string[];
  // resale checkout input (domain, CSR, seats…) keyed by field key
  resaleData?: Record<string, string>;
};

export type PricedLine = CartLine & {
  name: string;
  resaleData?: Record<string, string>;
  unitPrice: number;
  setupFee: number;
  lineTotal: number;
  config: Array<{ option: string; envKey: string | null; label: string; value: string; price: number }>;
};

function round(n: number): number {
  return roundCurrency(n);
}

// Config option values store a monthly price; scale it to the chosen cycle.
function scaleOptionPrice(monthly: number, cycle: BillingCycle): number {
  const months = CYCLE_MONTHS[cycle];
  return months === 0 ? monthly : monthly * months;
}

export async function priceCart(lines: CartLine[]): Promise<PricedLine[]> {
  const priced: PricedLine[] = [];
  for (const line of lines) {
    const product = await db.product.findUnique({
      where: { id: line.productId },
      include: {
        prices: true,
        configOptions: { include: { values: true } },
      },
    });
    if (!product || product.hidden) continue;
    const price = product.prices.find((p) => p.cycle === line.cycle);
    if (!price) continue;

    const config: PricedLine["config"] = [];
    let optionsTotal = 0;
    for (const option of product.configOptions) {
      const value = option.values.find((v) => line.optionValues.includes(v.id));
      if (!value) continue;
      const scaled = scaleOptionPrice(Number(value.price), line.cycle);
      optionsTotal += scaled;
      config.push({
        option: option.name,
        envKey: option.envKey,
        label: value.label,
        value: value.value,
        price: scaled,
      });
    }

    const quantity = product.allowQuantity ? Math.max(1, line.quantity) : 1;
    const unitPrice = round(Number(price.price) + optionsTotal);
    priced.push({
      ...line,
      quantity,
      name: product.name,
      resaleData: line.resaleData,
      unitPrice,
      setupFee: Number(price.setupFee),
      lineTotal: round(unitPrice * quantity + Number(price.setupFee)),
      config,
    });
  }
  return priced;
}

export async function validateCoupon(code: string, now = new Date()) {
  const coupon = await db.coupon.findUnique({
    where: { code },
    include: { products: { select: { id: true } } },
  });
  if (!coupon) return null;
  if (!isCouponAvailable(coupon, now)) return null;
  return coupon;
}

export async function computeTotals(
  lines: PricedLine[],
  couponCode: string | null,
  country: string | null,
  currency?: CheckoutCurrency,
  taxExempt = false,
) {
  // All math happens in base currency, then converts once at the end.
  const rate = currency?.rate ?? 1;
  const decimals = currency?.decimals ?? 2;
  const coupon = couponCode ? await validateCoupon(couponCode) : null;
  const settings = await getSettings(["tax_enabled", "currency"]);
  let taxRatePercent: number | null = null;
  if (settings.tax_enabled === "true" && !taxExempt) {
    const rates = await db.taxRate.findMany();
    const taxRate =
      rates.find((r) => r.country && r.country === country) ??
      rates.find((r) => !r.country);
    if (taxRate) taxRatePercent = Number(taxRate.rate);
  }

  const totals = calculateOrderTotals(
    lines,
    coupon
      ? {
          type: coupon.type,
          value: Number(coupon.value),
          productIds: coupon.products.map((product) => product.id),
        }
      : null,
    taxRatePercent,
    rate,
    decimals,
  );

  return {
    ...totals,
    coupon,
    currency: currency?.code ?? settings.currency,
    rate,
    decimals,
  };
}

// Creates the order with its invoice and pending services in one transaction.
export type OrderGuard = {
  reviewStatus?: "AUTO_APPROVED" | "PENDING_REVIEW";
  ip?: string | null;
  riskScore?: number | null;
  riskNotes?: string | null;
  taxExempt?: boolean;
};

export async function placeOrder(
  userId: string,
  lines: PricedLine[],
  couponCode: string | null,
  currency?: CheckoutCurrency,
  guard: OrderGuard = {},
) {
  if (lines.length === 0) throw new Error("Cart is empty");
  const user = await db.user.findUnique({ where: { id: userId } });
  const totals = await computeTotals(
    lines,
    couponCode,
    user?.country ?? null,
    currency,
    guard.taxExempt ?? false,
  );
  const rate = totals.rate;
  const decimals = totals.decimals;

  return db.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        userId,
        reviewStatus: guard.reviewStatus ?? "AUTO_APPROVED",
        ip: guard.ip ?? null,
        riskScore: guard.riskScore ?? null,
        riskNotes: guard.riskNotes ?? null,
        currency: totals.currency,
        subtotal: totals.subtotal,
        discount: totals.discount,
        tax: totals.tax,
        total: totals.total,
        couponId: totals.coupon?.id,
        items: {
          create: lines.map((l) => ({
            productId: l.productId,
            cycle: l.cycle,
            quantity: l.quantity,
            unitPrice: roundAsset(l.unitPrice * rate, decimals),
            setupFee: roundAsset(l.setupFee * rate, decimals),
            config: l.config,
          })),
        },
      },
    });

    if (totals.coupon) {
      await tx.coupon.update({
        where: { id: totals.coupon.id },
        data: { uses: { increment: 1 } },
      });
    }

    const services = await Promise.all(
      lines.map((l) =>
        tx.service.create({
          data: {
            userId,
            productId: l.productId,
            orderId: order.id,
            cycle: l.cycle,
            price: roundAsset(l.unitPrice * rate, decimals),
            currency: totals.currency,
            quantity: l.quantity,
            config: l.config,
            resaleData: l.resaleData ?? undefined,
          },
        }),
      ),
    );

    const invoice = await tx.invoice.create({
      data: {
        userId,
        orderId: order.id,
        currency: totals.currency,
        subtotal: totals.subtotal,
        discount: totals.discount,
        tax: totals.tax,
        total: totals.total,
        dueAt: new Date(),
        items: {
          create: lines.map((l, i) => ({
            description: `${l.name} (${l.cycle.toLowerCase().replace("_", "-")})`,
            quantity: l.quantity,
            unitPrice: roundAsset(l.unitPrice * rate, decimals),
            serviceId: services[i].id,
          })),
        },
      },
    });

    return { order, invoice };
  });
}
