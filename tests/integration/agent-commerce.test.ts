import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { db } from "@/lib/db";
import { createNativeAgentCheckout } from "@/lib/services/agent-checkout";

vi.mock("@/lib/services/notifications", () => ({ notifyUser: vi.fn() }));
vi.mock("@/lib/services/provisioning", () => ({
  provisionCreate: vi.fn(),
  provisionSuspend: vi.fn(),
  provisionTerminate: vi.fn(),
  provisionUnsuspend: vi.fn(),
}));
vi.mock("@/lib/services/resale", () => ({
  resaleProvision: vi.fn(),
  resaleRenew: vi.fn(),
  resaleCancel: vi.fn(),
}));

beforeEach(async () => {
  await db.user.deleteMany();
  await db.category.deleteMany();
  await db.currency.deleteMany();
  await db.setting.deleteMany();
});

afterAll(async () => {
  await db.$disconnect();
});

async function fixture(limit = 20) {
  await db.setting.create({ data: { key: "currency", value: "USD" } });
  const user = await db.user.create({
    data: {
      email: "agent-buyer@example.test",
      password: "not-used",
      firstName: "Agent",
      lastName: "Buyer",
    },
  });
  const category = await db.category.create({
    data: { name: "Agent products", slug: `agent-products-${limit}` },
  });
  const product = await db.product.create({
    data: {
      name: "Agent VPS",
      slug: `agent-vps-${limit}`,
      categoryId: category.id,
      prices: { create: { cycle: "MONTHLY", price: 10 } },
    },
  });
  const grant = await db.agentGrant.create({
    data: {
      name: "Test grant",
      tokenHash: `hash-${limit}`,
      prefix: "ag_test",
      userId: user.id,
      allowedProductIds: [product.id],
      allowedCurrencies: ["USD"],
      maxPerOrderBase: 10,
      spendLimitBase: limit,
      expiresAt: new Date(Date.now() + 86_400_000),
    },
    include: { user: true },
  });
  return { grant, product };
}

function checkoutInput(
  grant: Awaited<ReturnType<typeof fixture>>["grant"],
  productId: string,
  idempotencyKey: string,
) {
  return {
    grant,
    idempotencyKey,
    ip: "192.0.2.10",
    request: {
      currency: "USD",
      couponCode: null,
      lines: [
        {
          productId,
          cycle: "MONTHLY" as const,
          quantity: 1,
          optionValues: [],
        },
      ],
    },
  };
}

describe("delegated agent checkout", () => {
  test("replays an idempotent checkout without creating a second order", async () => {
    const { grant, product } = await fixture();
    const input = checkoutInput(grant, product.id, "deploy-one");

    const first = await createNativeAgentCheckout(input);
    const replay = await createNativeAgentCheckout(input);

    expect(replay.id).toBe(first.id);
    expect(replay.orderId).toBe(first.orderId);
    expect(await db.order.count()).toBe(1);
    expect((await db.agentGrant.findUniqueOrThrow({ where: { id: grant.id } })).committedBase.toString()).toBe("10");
  });

  test("serializes concurrent reservations so aggregate spend cannot exceed the cap", async () => {
    const { grant, product } = await fixture(10);
    const results = await Promise.allSettled([
      createNativeAgentCheckout(checkoutInput(grant, product.id, "deploy-a")),
      createNativeAgentCheckout(checkoutInput(grant, product.id, "deploy-b")),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(await db.order.count()).toBe(1);
    expect((await db.agentGrant.findUniqueOrThrow({ where: { id: grant.id } })).committedBase.toString()).toBe("10");
  });
});
