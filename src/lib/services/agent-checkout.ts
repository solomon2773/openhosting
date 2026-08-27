import "server-only";
import type { BillingCycle, Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/auth";
import { audit } from "@/lib/audit";
import {
  canonicalJson,
  validateDelegatedPurchase,
} from "@/lib/agent-commerce-policy";
import type { AgentPrincipal } from "@/lib/agent-auth";
import { roundCurrency } from "@/lib/billing-policy";
import { getEnabledCurrencies } from "@/lib/services/currency";
import { computeTotals, placeOrder, priceCart } from "@/lib/services/orders";
import { assessOrder, isTaxExempt } from "@/lib/services/fraud";
import { markInvoicePaid } from "@/lib/billing";
import { publicUrl } from "@/lib/settings";

export type AgentCheckoutLineInput = {
  productId: string;
  cycle: BillingCycle;
  quantity: number;
  optionValues: string[];
  resaleData?: Record<string, string>;
};

export type NativeAgentCheckoutInput = {
  currency: string;
  couponCode: string | null;
  lines: AgentCheckoutLineInput[];
};

export class AgentCheckoutError extends Error {
  constructor(
    message: string,
    public status = 422,
    public code = "checkout_rejected",
  ) {
    super(message);
  }
}

function prismaCode(error: unknown): string | null {
  return typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : null;
}

async function reserveGrantSpend(checkoutId: string, now: Date): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await db.$transaction(
        async (tx) => {
          const checkout = await tx.agentCheckout.findUnique({
            where: { id: checkoutId },
            include: { grant: true },
          });
          if (!checkout || checkout.status !== "DRAFT") {
            throw new AgentCheckoutError(
              "Checkout is already being processed.",
              409,
              "idempotency_in_flight",
            );
          }
          const request = checkout.request as NativeAgentCheckoutInput;
          const policyError = validateDelegatedPurchase(
            {
              ...checkout.grant,
              maxPerOrderBase: Number(checkout.grant.maxPerOrderBase),
              spendLimitBase: Number(checkout.grant.spendLimitBase),
              committedBase: Number(checkout.grant.committedBase),
            },
            {
              productIds: request.lines.map((line) => line.productId),
              currency: checkout.currency,
              baseAmount: Number(checkout.baseAmount),
            },
            now,
          );
          if (policyError) throw new AgentCheckoutError(policyError, 403, "grant_limit");

          await tx.agentGrant.update({
            where: { id: checkout.grantId },
            data: { committedBase: { increment: checkout.baseAmount } },
          });
          await tx.agentCheckout.update({
            where: { id: checkout.id },
            data: { status: "PROCESSING" },
          });
        },
        { isolationLevel: "Serializable" },
      );
      return;
    } catch (error) {
      if (prismaCode(error) === "P2034" && attempt < 2) continue;
      throw error;
    }
  }
}

async function releaseGrantSpend(checkoutId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const checkout = await tx.agentCheckout.findUnique({ where: { id: checkoutId } });
    if (!checkout || checkout.status !== "PROCESSING") return;
    await tx.agentGrant.update({
      where: { id: checkout.grantId },
      data: { committedBase: { decrement: checkout.baseAmount } },
    });
    await tx.agentCheckout.update({
      where: { id: checkout.id },
      data: { status: "FAILED" },
    });
  });
}

export async function createNativeAgentCheckout(input: {
  grant: AgentPrincipal;
  request: NativeAgentCheckoutInput;
  idempotencyKey: string;
  ip: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const normalizedRequest = {
    ...input.request,
    currency: input.request.currency.toUpperCase(),
  };
  const requestHash = sha256(canonicalJson(normalizedRequest));
  const existing = await db.agentCheckout.findUnique({
    where: {
      grantId_protocol_idempotencyKey: {
        grantId: input.grant.id,
        protocol: "native",
        idempotencyKey: input.idempotencyKey,
      },
    },
  });
  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new AgentCheckoutError(
        "The idempotency key was already used with a different request.",
        422,
        "idempotency_conflict",
      );
    }
    if (existing.status === "DRAFT" || existing.status === "PROCESSING") {
      throw new AgentCheckoutError(
        "The original checkout is still processing.",
        409,
        "idempotency_in_flight",
      );
    }
    return existing;
  }

  const currencies = await getEnabledCurrencies();
  const currency = currencies.find((item) => item.code === normalizedRequest.currency);
  if (!currency) {
    throw new AgentCheckoutError("Currency is not enabled.");
  }

  const priced = await priceCart(normalizedRequest.lines);
  if (priced.length !== normalizedRequest.lines.length) {
    throw new AgentCheckoutError("One or more products or billing cycles are unavailable.");
  }

  const verdict = await assessOrder(input.grant.user, input.ip);
  if (verdict.action === "block") {
    throw new AgentCheckoutError("Checkout was declined by the order policy.", 403, "order_blocked");
  }
  const taxExempt = await isTaxExempt(input.grant.user);
  const totals = await computeTotals(
    priced,
    normalizedRequest.couponCode,
    input.grant.user.country,
    currency,
    taxExempt,
  );
  const baseAmount = roundCurrency(totals.total / totals.rate);
  const policyError = validateDelegatedPurchase(
    {
      ...input.grant,
      maxPerOrderBase: Number(input.grant.maxPerOrderBase),
      spendLimitBase: Number(input.grant.spendLimitBase),
      committedBase: Number(input.grant.committedBase),
    },
    {
      productIds: normalizedRequest.lines.map((line) => line.productId),
      currency: currency.code,
      baseAmount,
    },
    now,
  );
  if (policyError) throw new AgentCheckoutError(policyError, 403, "grant_limit");

  let checkout;
  try {
    checkout = await db.agentCheckout.create({
      data: {
        grantId: input.grant.id,
        protocol: "native",
        idempotencyKey: input.idempotencyKey,
        requestHash,
        request: normalizedRequest as unknown as Prisma.InputJsonValue,
        currency: currency.code,
        amount: totals.total,
        baseAmount,
      },
    });
  } catch (error) {
    if (prismaCode(error) !== "P2002") throw error;
    const raced = await db.agentCheckout.findUnique({
      where: {
        grantId_protocol_idempotencyKey: {
          grantId: input.grant.id,
          protocol: "native",
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (!raced || raced.requestHash !== requestHash) {
      throw new AgentCheckoutError("Idempotency conflict.", 422, "idempotency_conflict");
    }
    return raced;
  }

  await reserveGrantSpend(checkout.id, now);
  try {
    const placed = await placeOrder(
      input.grant.userId,
      priced,
      normalizedRequest.couponCode,
      currency,
      {
        reviewStatus: verdict.action === "review" ? "PENDING_REVIEW" : "AUTO_APPROVED",
        ip: input.ip,
        riskScore: verdict.score,
        riskNotes: verdict.notes.join("; ") || null,
        taxExempt,
      },
    );
    let status: "PAYMENT_PENDING" | "PAID" = "PAYMENT_PENDING";
    if (Number(placed.invoice.total) === 0) {
      await markInvoicePaid(placed.invoice.id, "free", undefined, now);
      status = "PAID";
    }
    checkout = await db.agentCheckout.update({
      where: { id: checkout.id },
      data: {
        status,
        orderId: placed.order.id,
        invoiceId: placed.invoice.id,
        amount: placed.invoice.total,
      },
    });
    await audit("agent.checkout_created", {
      userId: input.grant.userId,
      targetType: "order",
      targetId: placed.order.id,
      metadata: { grantId: input.grant.id, protocol: "native" },
    });
    return checkout;
  } catch (error) {
    await releaseGrantSpend(checkout.id);
    throw error;
  }
}

export async function agentCheckoutRepresentation(checkoutId: string) {
  const checkout = await db.agentCheckout.findUnique({ where: { id: checkoutId } });
  if (!checkout) throw new AgentCheckoutError("Checkout not found.", 404, "not_found");
  const baseUrl = await publicUrl();
  const extensions = await db.extension.findMany({
    where: { enabled: true, type: "GATEWAY", slug: { in: ["stripe", "x402"] } },
    select: { slug: true },
  });
  const enabled = new Set(extensions.map((extension) => extension.slug));
  const paymentOptions: Array<Record<string, unknown>> = [];
  if (checkout.invoiceId && checkout.status === "PAYMENT_PENDING") {
    if (checkout.currency === "USDC" && enabled.has("x402")) {
      paymentOptions.push({
        type: "x402",
        method: "POST",
        url: `${baseUrl}/api/x402/invoices/${checkout.invoiceId}`,
        protocol_version: 2,
      });
    }
    if (checkout.currency !== "USDC" && enabled.has("stripe")) {
      paymentOptions.push({
        type: "hosted_checkout",
        provider: "stripe",
        url: `${baseUrl}/dashboard/invoices/${checkout.invoiceId}`,
      });
    }
  }
  return {
    id: checkout.id,
    status: checkout.status.toLowerCase(),
    currency: checkout.currency,
    amount: checkout.amount.toString(),
    order_id: checkout.orderId,
    invoice_id: checkout.invoiceId,
    invoice_url: checkout.invoiceId
      ? `${baseUrl}/dashboard/invoices/${checkout.invoiceId}`
      : null,
    payment_options: paymentOptions,
    created_at: checkout.createdAt.toISOString(),
    updated_at: checkout.updatedAt.toISOString(),
  };
}
