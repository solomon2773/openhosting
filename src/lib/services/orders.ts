import "server-only";
import type { BillingCycle } from "@prisma/client";
import { db } from "@/lib/db";
import { CYCLE_MONTHS } from "@/lib/format";
import { getSettings } from "@/lib/settings";

// Order service: turns a cart into an order + invoice + pending services,
// applying coupons and taxes. The only module that computes checkout math.

export type CartLine = {
  productId: string;
  cycle: BillingCycle;
  quantity: number;
  // chosen config option value ids
  optionValues: string[];
};

export type PricedLine = CartLine & {
  name: string;
  unitPrice: number;
  setupFee: number;
  lineTotal: number;
  config: Array<{ option: string; envKey: string | null; label: string; value: string; price: number }>;
};

function round(n: number): number {
  return Math.round(n * 100) / 100;
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
      unitPrice,
      setupFee: Number(price.setupFee),
      lineTotal: round(unitPrice * quantity + Number(price.setupFee)),
      config,
    });
  }
  return priced;
}

export async function validateCoupon(code: string) {
  const coupon = await db.coupon.findUnique({
    where: { code },
    include: { products: { select: { id: true } } },
  });
  if (!coupon) return null;
  if (coupon.expiresAt && coupon.expiresAt < new Date()) return null;
  if (coupon.maxUses !== null && coupon.uses >= coupon.maxUses) return null;
  return coupon;
}

export async function computeTotals(
  lines: PricedLine[],
  couponCode: string | null,
  country: string | null,
  currency?: { code: string; rate: number },
) {
  // All math happens in base currency, then converts once at the end.
  const rate = currency?.rate ?? 1;
  const subtotal = round(lines.reduce((sum, l) => sum + l.lineTotal, 0));

  let discount = 0;
  const coupon = couponCode ? await validateCoupon(couponCode) : null;
  if (coupon) {
    // A coupon restricted to products only discounts matching lines.
    const restricted = coupon.products.map((p) => p.id);
    const eligible =
      restricted.length === 0
        ? subtotal
        : round(
            lines
              .filter((l) => restricted.includes(l.productId))
              .reduce((sum, l) => sum + l.lineTotal, 0),
          );
    discount =
      coupon.type === "PERCENT"
        ? round((eligible * Number(coupon.value)) / 100)
        : Math.min(round(Number(coupon.value)), eligible);
  }

  let tax = 0;
  const settings = await getSettings(["tax_enabled", "currency"]);
  if (settings.tax_enabled === "true") {
    const rates = await db.taxRate.findMany();
    const taxRate =
      rates.find((r) => r.country && r.country === country) ??
      rates.find((r) => !r.country);
    if (taxRate) {
      tax = round(((subtotal - discount) * Number(taxRate.rate)) / 100);
    }
  }

  return {
    subtotal: round(subtotal * rate),
    discount: round(discount * rate),
    tax: round(tax * rate),
    total: round((subtotal - discount + tax) * rate),
    coupon,
    currency: currency?.code ?? settings.currency,
    rate,
  };
}

// Creates the order with its invoice and pending services in one transaction.
export async function placeOrder(
  userId: string,
  lines: PricedLine[],
  couponCode: string | null,
  currency?: { code: string; rate: number },
) {
  if (lines.length === 0) throw new Error("Cart is empty");
  const user = await db.user.findUnique({ where: { id: userId } });
  const totals = await computeTotals(
    lines,
    couponCode,
    user?.country ?? null,
    currency,
  );
  const rate = totals.rate;

  return db.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        userId,
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
            unitPrice: round(l.unitPrice * rate),
            setupFee: round(l.setupFee * rate),
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
            price: round(l.unitPrice * rate),
            currency: totals.currency,
            quantity: l.quantity,
            config: l.config,
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
            unitPrice: round(l.unitPrice * rate),
            serviceId: services[i].id,
          })),
        },
      },
    });

    return { order, invoice };
  });
}
