import "server-only";
import { db } from "@/lib/db";
import { addCycle, formatMoney, formatDate } from "@/lib/format";
import { getSetting, getSettings } from "@/lib/settings";
import { notifyUser } from "@/lib/services/notifications";
import {
  provisionCreate,
  provisionSuspend,
  provisionTerminate,
  provisionUnsuspend,
} from "@/lib/services/provisioning";

// Billing engine: invoice lifecycle and recurring billing. Provisioning is
// delegated to src/lib/services/provisioning (never concrete drivers here).

const DAY_MS = 86_400_000;

const serviceInclude = {
  user: true,
  product: { include: { serverExtension: true } },
} as const;

async function activateService(serviceId: string) {
  const service = await db.service.findUnique({
    where: { id: serviceId },
    include: serviceInclude,
  });
  if (!service) return;
  await provisionCreate(service);
  const url = await getSetting("company_url");
  await notifyUser(service.user, "service_activated", {
    title: `${service.product.name} is now active`,
    link: `/dashboard/services/${service.id}`,
    templateKey: "service_activated",
    templateVars: {
      name: service.user.firstName,
      product: service.product.name,
      url: `${url}/dashboard/services/${service.id}`,
    },
  });
}

// Marks an invoice paid and advances everything that hangs off it: order
// status, service activation (first payment) or renewal (subsequent ones).
export async function markInvoicePaid(
  invoiceId: string,
  gateway: string,
  transactionId?: string,
) {
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: { items: { include: { service: true } }, user: true },
  });
  if (!invoice || invoice.status === "PAID") return invoice;

  const now = new Date();
  await db.$transaction([
    db.invoice.update({
      where: { id: invoice.id },
      data: { status: "PAID", paidAt: now },
    }),
    db.payment.create({
      data: {
        invoiceId: invoice.id,
        gateway,
        amount: invoice.total,
        currency: invoice.currency,
        status: "COMPLETED",
        transactionId,
      },
    }),
    ...(invoice.orderId
      ? [
          db.order.update({
            where: { id: invoice.orderId },
            data: { status: "PAID" },
          }),
        ]
      : []),
  ]);

  for (const item of invoice.items) {
    // upgrade invoices switch the service's product on payment
    const upgradeMeta = item.metadata as {
      upgradeServiceId?: string;
      toProductId?: string;
      newPrice?: number;
    } | null;
    if (upgradeMeta?.upgradeServiceId && upgradeMeta.toProductId) {
      const { applyUpgrade } = await import("@/lib/services/upgrades");
      await applyUpgrade(
        upgradeMeta.upgradeServiceId,
        upgradeMeta.toProductId,
        upgradeMeta.newPrice ?? 0,
      );
      continue;
    }

    const service = item.service;
    if (!service) continue;
    if (service.status === "PENDING") {
      await db.service.update({
        where: { id: service.id },
        data: {
          status: "ACTIVE",
          expiresAt:
            service.cycle === "ONE_TIME" ? null : addCycle(now, service.cycle),
        },
      });
      await activateService(service.id);
    } else if (service.status === "ACTIVE" || service.status === "SUSPENDED") {
      const base =
        service.expiresAt && service.expiresAt > now ? service.expiresAt : now;
      const updated = await db.service.update({
        where: { id: service.id },
        data: {
          status: "ACTIVE",
          suspendedAt: null,
          expiresAt: addCycle(base, service.cycle),
        },
        include: serviceInclude,
      });
      if (service.status === "SUSPENDED") await provisionUnsuspend(updated);
    }
  }

  await notifyUser(invoice.user, "invoice_paid", {
    title: `Payment received for invoice #${invoice.number}`,
    link: `/dashboard/invoices/${invoice.id}`,
    templateKey: "invoice_paid",
    templateVars: {
      name: invoice.user.firstName,
      invoice: String(invoice.number),
      total: formatMoney(invoice.total, invoice.currency),
    },
  });
  return db.invoice.findUnique({ where: { id: invoiceId } });
}

// ── Recurring billing (called from the cron endpoint) ───────────────────────

export async function generateRenewalInvoices(): Promise<number> {
  const settings = await getSettings([
    "invoice_days_before",
    "currency",
    "company_name",
    "company_url",
  ]);
  const horizon = new Date(
    Date.now() + Number(settings.invoice_days_before) * DAY_MS,
  );
  const services = await db.service.findMany({
    where: {
      status: "ACTIVE",
      cycle: { not: "ONE_TIME" },
      cancelAtPeriodEnd: false,
      expiresAt: { lte: horizon },
      // no open renewal invoice yet
      invoiceItems: { none: { invoice: { status: "PENDING" } } },
    },
    include: { user: true, product: true },
  });

  let created = 0;
  for (const service of services) {
    const total = Number(service.price) * service.quantity;
    // services are priced in the currency locked at order time
    const currency = service.currency ?? settings.currency;
    const invoice = await db.invoice.create({
      data: {
        userId: service.userId,
        currency,
        subtotal: total,
        total,
        dueAt: service.expiresAt,
        items: {
          create: {
            description: `${service.product.name} — renewal until ${formatDate(
              service.expiresAt
                ? addCycle(service.expiresAt, service.cycle)
                : null,
            )}`,
            quantity: service.quantity,
            unitPrice: service.price,
            serviceId: service.id,
          },
        },
      },
    });
    created++;
    await notifyUser(service.user, "invoice_created", {
      title: `Invoice #${invoice.number} is due ${formatDate(invoice.dueAt)}`,
      link: `/dashboard/invoices/${invoice.id}`,
      templateKey: "invoice_created",
      templateVars: {
        name: service.user.firstName,
        invoice: String(invoice.number),
        company: settings.company_name,
        total: formatMoney(total, currency),
        due: formatDate(invoice.dueAt),
        link: `${settings.company_url}/dashboard/invoices/${invoice.id}`,
      },
    });
  }
  return created;
}

// Executes customer-scheduled end-of-term cancellations once the paid
// period is over.
export async function cancelEndOfTermServices(): Promise<number> {
  const services = await db.service.findMany({
    where: {
      status: "ACTIVE",
      cancelAtPeriodEnd: true,
      expiresAt: { lte: new Date() },
    },
    include: serviceInclude,
  });
  for (const service of services) {
    await db.service.update({
      where: { id: service.id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    await provisionTerminate(service);
  }
  return services.length;
}

export async function suspendOverdueServices(): Promise<number> {
  const graceDays = Number(await getSetting("suspend_days_after"));
  const cutoff = new Date(Date.now() - graceDays * DAY_MS);
  const services = await db.service.findMany({
    where: {
      status: "ACTIVE",
      cancelAtPeriodEnd: false,
      expiresAt: { lte: cutoff },
    },
    include: serviceInclude,
  });
  for (const service of services) {
    await db.service.update({
      where: { id: service.id },
      data: { status: "SUSPENDED", suspendedAt: new Date() },
    });
    await provisionSuspend(service);
    await notifyUser(service.user, "service_suspended", {
      title: `${service.product.name} was suspended (unpaid invoice)`,
      link: `/dashboard/invoices`,
      templateKey: "service_suspended",
      templateVars: {
        name: service.user.firstName,
        product: service.product.name,
      },
    });
  }
  return services.length;
}

export async function cancelStaleSuspendedServices(): Promise<number> {
  const cancelDays = Number(await getSetting("cancel_days_after"));
  const cutoff = new Date(Date.now() - cancelDays * DAY_MS);
  const services = await db.service.findMany({
    where: { status: "SUSPENDED", suspendedAt: { lte: cutoff } },
    include: serviceInclude,
  });
  for (const service of services) {
    await db.service.update({
      where: { id: service.id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    await provisionTerminate(service);
    // void any open invoices for this service
    await db.invoice.updateMany({
      where: { status: "PENDING", items: { some: { serviceId: service.id } } },
      data: { status: "CANCELLED" },
    });
  }
  return services.length;
}
