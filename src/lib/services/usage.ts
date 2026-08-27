import "server-only";
import { db } from "@/lib/db";
import { roundAsset } from "@/lib/billing-policy";

// Usage service: records metered usage and rolls unbilled usage into invoices.

export async function recordUsage(
  serviceId: string,
  quantity: number,
  description?: string,
): Promise<{ error?: string }> {
  const service = await db.service.findUnique({
    where: { id: serviceId },
    include: { product: true },
  });
  if (!service) return { error: "Service not found" };
  if (!service.product.metered) {
    return { error: "Product is not metered" };
  }
  await db.usageRecord.create({
    data: { serviceId, quantity, description: description ?? null },
  });
  return {};
}

// Sums unbilled usage for a service and marks it billed. Returns the total
// quantity and the line amount at the product's metered unit price.
export async function consumeUnbilledUsage(serviceId: string): Promise<{
  quantity: number;
  amount: number;
  unit: string | null;
} | null> {
  const service = await db.service.findUnique({
    where: { id: serviceId },
    include: { product: true },
  });
  if (!service?.product.metered || !service.product.meteredUnitPrice) return null;

  const records = await db.usageRecord.findMany({
    where: { serviceId, billed: false },
  });
  if (records.length === 0) return null;

  const quantity = records.reduce((sum, r) => sum + Number(r.quantity), 0);
  // Preserve sub-cent usage until it is converted into the service's locked
  // charge currency. The invoice boundary applies that asset's precision.
  const amount = roundAsset(
    quantity * Number(service.product.meteredUnitPrice),
    8,
  );

  await db.usageRecord.updateMany({
    where: { id: { in: records.map((r) => r.id) } },
    data: { billed: true },
  });

  return { quantity, amount, unit: service.product.meteredUnit };
}
