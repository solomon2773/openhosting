import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { db } from "@/lib/db";
import {
  cancelEndOfTermServices,
  cancelStaleSuspendedServices,
  generateRenewalInvoices,
  suspendOverdueServices,
} from "@/lib/billing";

const integrationMocks = vi.hoisted(() => ({
  notifyUser: vi.fn(),
  provisionSuspend: vi.fn(),
  provisionTerminate: vi.fn(),
  resaleCancel: vi.fn(),
}));

vi.mock("@/lib/services/notifications", () => ({
  notifyUser: integrationMocks.notifyUser,
}));

vi.mock("@/lib/services/provisioning", () => ({
  provisionCreate: vi.fn(),
  provisionSuspend: integrationMocks.provisionSuspend,
  provisionTerminate: integrationMocks.provisionTerminate,
  provisionUnsuspend: vi.fn(),
}));

vi.mock("@/lib/services/resale", () => ({
  resaleCancel: integrationMocks.resaleCancel,
  resaleProvision: vi.fn(),
  resaleRenew: vi.fn(),
}));

vi.mock("@/lib/services/affiliates", () => ({
  creditCommission: vi.fn(),
}));

beforeEach(async () => {
  await db.user.deleteMany();
  await db.category.deleteMany();
  await db.currency.deleteMany();
  await db.setting.deleteMany();
  vi.clearAllMocks();
});

afterAll(async () => {
  await db.$disconnect();
});

async function createCustomerAndProduct() {
  const user = await db.user.create({
    data: {
      email: "billing-test@example.test",
      password: "not-used-in-tests",
      firstName: "Billing",
      lastName: "Test",
    },
  });
  const category = await db.category.create({
    data: { name: "Test hosting", slug: "test-hosting" },
  });
  const product = await db.product.create({
    data: {
      name: "Test VPS",
      slug: "test-vps",
      categoryId: category.id,
    },
  });

  return { user, product };
}

describe("renewal invoice generation", () => {
  test("includes the horizon boundary and remains idempotent while an invoice is open", async () => {
    const now = new Date("2026-08-27T12:00:00.000Z");
    const horizon = new Date("2026-09-03T12:00:00.000Z");
    const { user, product } = await createCustomerAndProduct();
    const dueService = await db.service.create({
      data: {
        userId: user.id,
        productId: product.id,
        status: "ACTIVE",
        cycle: "MONTHLY",
        price: 25,
        currency: "USD",
        quantity: 2,
        expiresAt: horizon,
      },
    });
    await db.service.create({
      data: {
        userId: user.id,
        productId: product.id,
        status: "ACTIVE",
        cycle: "MONTHLY",
        price: 40,
        currency: "USD",
        expiresAt: new Date(horizon.getTime() + 1),
      },
    });

    expect(await generateRenewalInvoices(now)).toBe(1);
    expect(await generateRenewalInvoices(now)).toBe(0);

    const invoices = await db.invoice.findMany({
      include: { items: true },
    });
    expect(invoices).toHaveLength(1);
    expect(Number(invoices[0].total)).toBe(50);
    expect(invoices[0].dueAt).toEqual(horizon);
    expect(invoices[0].items).toEqual([
      expect.objectContaining({
        serviceId: dueService.id,
        quantity: 2,
        unitPrice: expect.objectContaining({}),
      }),
    ]);
    expect(Number(invoices[0].items[0].unitPrice)).toBe(25);
  });

  test("converts sub-cent metered usage into a USDC-locked renewal", async () => {
    const now = new Date("2026-08-27T12:00:00.000Z");
    const { user, product } = await createCustomerAndProduct();
    await db.setting.createMany({
      data: [
        { key: "currency", value: "USD" },
        { key: "invoice_days_before", value: "7" },
      ],
    });
    await db.currency.create({
      data: {
        code: "USDC",
        kind: "STABLECOIN",
        decimals: 6,
        settlementNetworks: ["eip155:8453"],
        rate: 1,
      },
    });
    await db.product.update({
      where: { id: product.id },
      data: { metered: true, meteredUnit: "request", meteredUnitPrice: 0.000001 },
    });
    const service = await db.service.create({
      data: {
        userId: user.id,
        productId: product.id,
        status: "ACTIVE",
        cycle: "MONTHLY",
        price: 5,
        currency: "USDC",
        expiresAt: now,
      },
    });
    await db.usageRecord.create({
      data: { serviceId: service.id, quantity: 1 },
    });

    expect(await generateRenewalInvoices(now)).toBe(1);
    const invoice = await db.invoice.findFirstOrThrow({
      where: { userId: user.id },
      include: { items: true },
    });
    expect(invoice.currency).toBe("USDC");
    expect(invoice.total.toString()).toBe("5.000001");
    expect(invoice.items[1].unitPrice.toString()).toBe("0.000001");
  });
});

describe("service lifecycle cutoffs", () => {
  test("suspends an active service exactly at the configured grace cutoff", async () => {
    const now = new Date("2026-08-27T12:00:00.000Z");
    const cutoff = new Date("2026-08-25T12:00:00.000Z");
    const { user, product } = await createCustomerAndProduct();
    await db.setting.create({
      data: { key: "suspend_days_after", value: "2" },
    });
    const dueService = await db.service.create({
      data: {
        userId: user.id,
        productId: product.id,
        status: "ACTIVE",
        cycle: "MONTHLY",
        price: 25,
        expiresAt: cutoff,
      },
    });
    const stillActive = await db.service.create({
      data: {
        userId: user.id,
        productId: product.id,
        status: "ACTIVE",
        cycle: "MONTHLY",
        price: 25,
        expiresAt: new Date(cutoff.getTime() + 1),
      },
    });

    expect(await suspendOverdueServices(now)).toBe(1);
    expect(await db.service.findUnique({ where: { id: dueService.id } })).toEqual(
      expect.objectContaining({ status: "SUSPENDED", suspendedAt: now }),
    );
    expect(
      await db.service.findUnique({ where: { id: stillActive.id } }),
    ).toEqual(expect.objectContaining({ status: "ACTIVE", suspendedAt: null }));
    expect(integrationMocks.provisionSuspend).toHaveBeenCalledTimes(1);
  });

  test("cancels suspended and end-of-term services at their exact cutoffs", async () => {
    const now = new Date("2026-08-27T12:00:00.000Z");
    const staleCutoff = new Date("2026-08-13T12:00:00.000Z");
    const { user, product } = await createCustomerAndProduct();
    await db.setting.create({
      data: { key: "cancel_days_after", value: "14" },
    });
    const stale = await db.service.create({
      data: {
        userId: user.id,
        productId: product.id,
        status: "SUSPENDED",
        cycle: "MONTHLY",
        price: 25,
        suspendedAt: staleCutoff,
      },
    });
    const endOfTerm = await db.service.create({
      data: {
        userId: user.id,
        productId: product.id,
        status: "ACTIVE",
        cycle: "MONTHLY",
        price: 25,
        expiresAt: now,
        cancelAtPeriodEnd: true,
      },
    });

    expect(await cancelStaleSuspendedServices(now)).toBe(1);
    expect(await cancelEndOfTermServices(now)).toBe(1);

    const cancelled = await db.service.findMany({
      where: { id: { in: [stale.id, endOfTerm.id] } },
    });
    expect(cancelled).toHaveLength(2);
    expect(cancelled.every((service) => service.status === "CANCELLED")).toBe(
      true,
    );
    expect(cancelled.every((service) => service.cancelledAt?.getTime() === now.getTime())).toBe(
      true,
    );
    expect(integrationMocks.provisionTerminate).toHaveBeenCalledTimes(2);
    expect(integrationMocks.resaleCancel).toHaveBeenCalledTimes(2);
  });
});
