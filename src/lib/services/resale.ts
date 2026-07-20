import "server-only";
import type { Extension, Product, Service, User } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getResaleDriver } from "@/lib/extensions/registry";
import { extensionConfig } from "@/lib/extensions/types";

// Resale service: the only module that resolves and invokes resale drivers.
// Billing calls these lifecycle functions; it never sees a concrete driver.

type ServiceWithProduct = Service & {
  product: Product & { resaleExtension: Extension | null };
};

function resolve(service: ServiceWithProduct) {
  const ext = service.product.resaleExtension;
  if (!ext?.enabled) return null;
  const driver = getResaleDriver(ext.slug);
  if (!driver) return null;
  return { driver, config: extensionConfig(ext), ext };
}

async function logFailure(action: string, serviceId: string, err: unknown) {
  await db.auditLog.create({
    data: {
      action: `resale.${action}_failed`,
      targetType: "service",
      targetId: serviceId,
      metadata: { error: err instanceof Error ? err.message : String(err) },
    },
  });
}

export async function resaleProvision(
  service: ServiceWithProduct & { user: User },
): Promise<void> {
  const resolved = resolve(service);
  if (!resolved) return;
  try {
    const externalId = await resolved.driver.provision(
      service,
      resolved.config,
      (service.product.resaleConfig ?? {}) as Record<string, string>,
      (service.resaleData ?? {}) as Record<string, string>,
    );
    if (externalId) {
      await db.service.update({
        where: { id: service.id },
        data: { externalId },
      });
    }
  } catch (err) {
    await logFailure("provision", service.id, err);
  }
}

export async function resaleRenew(service: ServiceWithProduct): Promise<void> {
  const resolved = resolve(service);
  if (!resolved?.driver.renew) return;
  await resolved.driver
    .renew(
      service,
      resolved.config,
      (service.product.resaleConfig ?? {}) as Record<string, string>,
    )
    .catch((err) => logFailure("renew", service.id, err));
}

export async function resaleCancel(service: ServiceWithProduct): Promise<void> {
  const resolved = resolve(service);
  if (!resolved) return;
  await resolved.driver
    .cancel(service, resolved.config)
    .catch((err) => logFailure("cancel", service.id, err));
}
