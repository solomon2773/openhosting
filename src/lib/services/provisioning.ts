import "server-only";
import type { Extension, Product, Service, User } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getServerDriver } from "@/lib/extensions/registry";
import { extensionConfig } from "@/lib/extensions/types";

// Provisioning service: the only module that resolves and invokes server
// drivers. Billing and admin code call these lifecycle functions and never
// touch a concrete driver (dependency inversion); adding a backend never
// changes this file or its callers (open/closed).

type ServiceWithProduct = Service & {
  product: Product & { serverExtension: Extension | null };
};

function resolveDriver(service: ServiceWithProduct) {
  const ext = service.product.serverExtension;
  if (!ext?.enabled) return null;
  const driver = getServerDriver(ext.slug);
  if (!driver) return null;
  return { driver, config: extensionConfig(ext), ext };
}

async function logFailure(action: string, serviceId: string, err: unknown) {
  await db.auditLog.create({
    data: {
      action: `service.${action}_failed`,
      targetType: "service",
      targetId: serviceId,
      metadata: { error: err instanceof Error ? err.message : String(err) },
    },
  });
}

export async function provisionCreate(
  service: ServiceWithProduct & { user: User },
): Promise<void> {
  const resolved = resolveDriver(service);
  if (!resolved) return;
  try {
    const externalId = await resolved.driver.create(
      service,
      resolved.config,
      (service.product.serverConfig ?? {}) as Record<string, string>,
    );
    await db.service.update({
      where: { id: service.id },
      data: { externalId },
    });
  } catch (err) {
    await logFailure("provision", service.id, err);
  }
}

export async function provisionSuspend(service: ServiceWithProduct) {
  const resolved = resolveDriver(service);
  if (!resolved) return;
  await resolved.driver
    .suspend(service, resolved.config)
    .catch((err) => logFailure("suspend", service.id, err));
}

export async function provisionUnsuspend(service: ServiceWithProduct) {
  const resolved = resolveDriver(service);
  if (!resolved) return;
  await resolved.driver
    .unsuspend(service, resolved.config)
    .catch((err) => logFailure("unsuspend", service.id, err));
}

export async function provisionTerminate(service: ServiceWithProduct) {
  const resolved = resolveDriver(service);
  if (!resolved) return;
  await resolved.driver
    .terminate(service, resolved.config)
    .catch((err) => logFailure("terminate", service.id, err));
}
