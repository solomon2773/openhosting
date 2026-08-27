import { afterAll, beforeEach, expect, test, vi } from "vitest";
import { POST as settleInvoice } from "@/app/api/x402/invoices/[id]/route";
import { sha256 } from "@/lib/auth";
import { db } from "@/lib/db";
import { decodeX402Header, encodeX402Header } from "@/lib/x402";

const rawGrant = "ag_integrationtesttoken";

beforeEach(async () => {
  vi.unstubAllGlobals();
  await db.user.deleteMany();
  await db.extension.deleteMany();
  await db.currency.deleteMany();
  await db.setting.deleteMany();
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await db.$disconnect();
});

test("advertises, verifies, settles, and idempotently records an exact USDC payment", async () => {
  await db.setting.create({
    data: { key: "company_url", value: "https://merchant.example.test" },
  });
  const user = await db.user.create({
    data: {
      email: "x402-buyer@example.test",
      password: "not-used",
      firstName: "USDC",
      lastName: "Buyer",
    },
  });
  await db.agentGrant.create({
    data: {
      name: "x402 test",
      tokenHash: sha256(rawGrant),
      prefix: "ag_integratio",
      userId: user.id,
      allowedProductIds: [],
      allowedCurrencies: ["USDC"],
      maxPerOrderBase: 100,
      spendLimitBase: 100,
      expiresAt: new Date(Date.now() + 60_000),
    },
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
  await db.extension.create({
    data: {
      slug: "x402",
      name: "x402 (USDC)",
      type: "GATEWAY",
      enabled: true,
      config: {
        facilitator_url: "https://facilitator.example.test",
        network: "eip155:8453",
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        pay_to: "0x1111111111111111111111111111111111111111",
      },
    },
  });
  const invoice = await db.invoice.create({
    data: {
      userId: user.id,
      currency: "USDC",
      subtotal: 1.01,
      total: 1.01,
    },
  });
  const url = `https://merchant.example.test/api/x402/invoices/${invoice.id}`;
  const authorization = { Authorization: `Bearer ${rawGrant}` };

  const challenge = await settleInvoice(
    new Request(url, { method: "POST", headers: authorization }),
    { params: Promise.resolve({ id: invoice.id }) },
  );
  expect(challenge.status).toBe(402);
  const required = decodeX402Header(challenge.headers.get("payment-required")!);
  expect(required).toMatchObject({
    x402Version: 2,
    accepts: [{ network: "eip155:8453", amount: "1010000" }],
  });

  const paymentPayload = {
    x402Version: 2,
    resource: required.resource,
    accepted: (required.accepts as unknown[])[0],
    payload: { signature: "0xsigned", authorization: { nonce: "0xnonce" } },
  };
  const facilitator = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ isValid: true, payer: "0xbuyer" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          transaction: "0xtransaction",
          network: "eip155:8453",
          payer: "0xbuyer",
          amount: "1010000",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
  vi.stubGlobal("fetch", facilitator);

  const paid = await settleInvoice(
    new Request(url, {
      method: "POST",
      headers: {
        ...authorization,
        "PAYMENT-SIGNATURE": encodeX402Header(paymentPayload),
      },
    }),
    { params: Promise.resolve({ id: invoice.id }) },
  );
  expect(paid.status).toBe(200);
  expect(paid.headers.get("payment-response")).toBeTruthy();
  expect(facilitator).toHaveBeenCalledTimes(2);
  expect(await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).toEqual(
    expect.objectContaining({ status: "PAID" }),
  );
  expect(await db.payment.count({ where: { invoiceId: invoice.id } })).toBe(1);

  const replay = await settleInvoice(
    new Request(url, {
      method: "POST",
      headers: {
        ...authorization,
        "PAYMENT-SIGNATURE": encodeX402Header(paymentPayload),
      },
    }),
    { params: Promise.resolve({ id: invoice.id }) },
  );
  expect(replay.status).toBe(200);
  expect(facilitator).toHaveBeenCalledTimes(2);
  expect(await db.payment.count({ where: { invoiceId: invoice.id } })).toBe(1);
});
