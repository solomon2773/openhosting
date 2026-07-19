import "server-only";
import { db } from "@/lib/db";
import { CYCLE_MONTHS } from "@/lib/format";
import { getEnabledCurrencies } from "@/lib/services/currency";
import { getSetting } from "@/lib/settings";

// Upgrade service: prorated product upgrades along admin-defined paths.

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type UpgradeOption = {
  toProductId: string;
  toProductName: string;
  // full recurring price of the new product in the service's currency
  newPrice: number;
  // prorated amount due now (0 for downgrades / free switches)
  proratedCharge: number;
  currency: string;
};

// Converts a base-currency amount into the service's locked currency.
async function toServiceCurrency(
  amount: number,
  serviceCurrency: string | null,
): Promise<number> {
  const base = await getSetting("currency");
  const code = serviceCurrency ?? base;
  if (code === base) return round2(amount);
  const currencies = await getEnabledCurrencies();
  const currency = currencies.find((c) => c.code === code);
  return round2(amount * (currency?.rate ?? 1));
}

export async function upgradeOptionsForService(
  serviceId: string,
): Promise<UpgradeOption[]> {
  const service = await db.service.findUnique({
    where: { id: serviceId },
    include: { product: { include: { upgradesFrom: { include: { toProduct: { include: { prices: true } } } } } } },
  });
  if (!service || service.status !== "ACTIVE") return [];

  const options: UpgradeOption[] = [];
  for (const path of service.product.upgradesFrom) {
    const price = path.toProduct.prices.find((p) => p.cycle === service.cycle);
    if (!price || path.toProduct.hidden) continue;
    const newPrice = await toServiceCurrency(
      Number(price.price),
      service.currency,
    );

    // remaining fraction of the current billing period
    let fraction = 0;
    if (service.expiresAt && service.cycle !== "ONE_TIME") {
      const cycleDays = CYCLE_MONTHS[service.cycle] * 30.44;
      const remainingDays = Math.max(
        0,
        (service.expiresAt.getTime() - Date.now()) / 86_400_000,
      );
      fraction = Math.min(1, remainingDays / cycleDays);
    }
    const difference = newPrice - Number(service.price);
    options.push({
      toProductId: path.toProductId,
      toProductName: path.toProduct.name,
      newPrice,
      proratedCharge: difference > 0 ? round2(difference * fraction) : 0,
      currency: service.currency ?? (await getSetting("currency")),
    });
  }
  return options;
}

// Creates the upgrade invoice, or applies the upgrade immediately when
// nothing is due (downgrades / zero-charge switches).
export async function requestUpgrade(
  userId: string,
  serviceId: string,
  toProductId: string,
): Promise<{ invoiceId?: string; applied?: boolean; error?: string }> {
  const service = await db.service.findUnique({ where: { id: serviceId } });
  if (!service || service.userId !== userId || service.status !== "ACTIVE") {
    return { error: "Service is not eligible for upgrades." };
  }
  const option = (await upgradeOptionsForService(serviceId)).find(
    (o) => o.toProductId === toProductId,
  );
  if (!option) return { error: "This upgrade path is not available." };

  if (option.proratedCharge <= 0) {
    await applyUpgrade(serviceId, toProductId, option.newPrice);
    return { applied: true };
  }

  const invoice = await db.invoice.create({
    data: {
      userId,
      currency: option.currency,
      subtotal: option.proratedCharge,
      total: option.proratedCharge,
      dueAt: new Date(),
      items: {
        create: {
          description: `Upgrade to ${option.toProductName} (prorated)`,
          quantity: 1,
          unitPrice: option.proratedCharge,
          metadata: {
            upgradeServiceId: serviceId,
            toProductId,
            newPrice: option.newPrice,
          },
        },
      },
    },
  });
  return { invoiceId: invoice.id };
}

export async function applyUpgrade(
  serviceId: string,
  toProductId: string,
  newPrice: number,
): Promise<void> {
  await db.service.update({
    where: { id: serviceId },
    data: { productId: toProductId, price: newPrice },
  });
}
