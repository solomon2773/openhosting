import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/auth";
import type { AgentPrincipal } from "@/lib/agent-auth";
import {
  ACP_VERSION,
  canonicalJson,
  toAtomicUnits,
  validateDelegatedPurchase,
} from "@/lib/agent-commerce-policy";
import { roundCurrency } from "@/lib/billing-policy";
import { getEnabledCurrencies } from "@/lib/services/currency";
import { computeTotals, priceCart } from "@/lib/services/orders";
import {
  AgentCheckoutError,
  createNativeAgentCheckout,
  type NativeAgentCheckoutInput,
} from "@/lib/services/agent-checkout";
import { getGatewayDriver } from "@/lib/extensions/registry";
import { extensionConfig } from "@/lib/extensions/types";
import { markInvoicePaid } from "@/lib/billing";
import { publicUrl } from "@/lib/settings";

type AcpStoredRequest = {
  native: NativeAgentCheckoutInput;
  skus: string[];
  buyer?: Record<string, unknown>;
  capabilities: Record<string, unknown>;
};

type AcpCreateInput = {
  currency: string;
  lineItems: Array<{ id: string; quantity: number }>;
  couponCode: string | null;
  buyer?: Record<string, unknown>;
  capabilities: Record<string, unknown>;
};

function prismaCode(error: unknown): string | null {
  return typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : null;
}

async function quoteAcpRequest(grant: AgentPrincipal, input: AcpCreateInput) {
  const code = input.currency.toUpperCase();
  const currencies = await getEnabledCurrencies();
  const currency = currencies.find((item) => item.code === code);
  if (!currency || currency.kind !== "FIAT" || currency.decimals !== 2 || code.length !== 3) {
    throw new AgentCheckoutError(
      "ACP checkout currently requires an enabled two-decimal ISO fiat currency.",
    );
  }
  const uniqueSkus = [...new Set(input.lineItems.map((item) => item.id))];
  const prices = await db.productPrice.findMany({
    where: { id: { in: uniqueSkus } },
    include: { product: true },
  });
  const byId = new Map(prices.map((price) => [price.id, price]));
  const lines = input.lineItems.map((item) => {
    const price = byId.get(item.id);
    if (!price || price.product.hidden) {
      throw new AgentCheckoutError("One or more ACP item IDs are unavailable.");
    }
    return {
      productId: price.productId,
      cycle: price.cycle,
      quantity: item.quantity,
      optionValues: [],
    };
  });
  const priced = await priceCart(lines);
  if (priced.length !== lines.length) {
    throw new AgentCheckoutError("One or more ACP items are unavailable.");
  }
  const { isTaxExempt } = await import("@/lib/services/fraud");
  const totals = await computeTotals(
    priced,
    input.couponCode,
    grant.user.country,
    currency,
    await isTaxExempt(grant.user),
  );
  const baseAmount = roundCurrency(totals.total / totals.rate);
  const policyError = validateDelegatedPurchase(
    {
      ...grant,
      maxPerOrderBase: Number(grant.maxPerOrderBase),
      spendLimitBase: Number(grant.spendLimitBase),
      committedBase: Number(grant.committedBase),
    },
    { productIds: lines.map((line) => line.productId), currency: code, baseAmount },
    new Date(),
  );
  if (policyError) throw new AgentCheckoutError(policyError, 403, "grant_limit");
  const stored: AcpStoredRequest = {
    native: { currency: code, couponCode: input.couponCode, lines },
    skus: input.lineItems.map((item) => item.id),
    buyer: input.buyer,
    capabilities: input.capabilities,
  };
  return { stored, totals, baseAmount };
}

export async function createAcpSession(input: {
  grant: AgentPrincipal;
  request: AcpCreateInput;
  idempotencyKey: string;
}) {
  const requestHash = sha256(canonicalJson(input.request));
  const unique = {
    grantId: input.grant.id,
    protocol: "acp",
    idempotencyKey: input.idempotencyKey,
  };
  const existing = await db.agentCheckout.findUnique({
    where: { grantId_protocol_idempotencyKey: unique },
  });
  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new AgentCheckoutError(
        "The idempotency key was already used with a different request.",
        422,
        "idempotency_conflict",
      );
    }
    return { checkout: existing, replayed: true };
  }
  const quote = await quoteAcpRequest(input.grant, input.request);
  try {
    const checkout = await db.agentCheckout.create({
      data: {
        ...unique,
        requestHash,
        request: quote.stored as unknown as Prisma.InputJsonValue,
        currency: quote.totals.currency,
        amount: quote.totals.total,
        baseAmount: quote.baseAmount,
      },
    });
    return { checkout, replayed: false };
  } catch (error) {
    if (prismaCode(error) !== "P2002") throw error;
    const raced = await db.agentCheckout.findUnique({
      where: { grantId_protocol_idempotencyKey: unique },
    });
    if (!raced || raced.requestHash !== requestHash) {
      throw new AgentCheckoutError("Idempotency conflict.", 422, "idempotency_conflict");
    }
    return { checkout: raced, replayed: true };
  }
}

async function beginOperation(input: {
  checkoutId: string;
  operation: string;
  idempotencyKey: string;
  request: unknown;
}) {
  const requestHash = sha256(canonicalJson(input.request));
  const where = {
    checkoutId_operation_idempotencyKey: {
      checkoutId: input.checkoutId,
      operation: input.operation,
      idempotencyKey: input.idempotencyKey,
    },
  };
  const existing = await db.agentCheckoutOperation.findUnique({ where });
  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new AgentCheckoutError(
        "The idempotency key was already used with a different request.",
        422,
        "idempotency_conflict",
      );
    }
    if (existing.response) return { operation: existing, replayed: true };
    if (existing.createdAt.getTime() > Date.now() - 120_000) {
      throw new AgentCheckoutError(
        "The original operation is still processing.",
        409,
        "idempotency_in_flight",
      );
    }
    return { operation: existing, replayed: false };
  }
  try {
    return {
      operation: await db.agentCheckoutOperation.create({
        data: {
          checkoutId: input.checkoutId,
          operation: input.operation,
          idempotencyKey: input.idempotencyKey,
          requestHash,
        },
      }),
      replayed: false,
    };
  } catch (error) {
    if (prismaCode(error) === "P2002") {
      throw new AgentCheckoutError(
        "The original operation is still processing.",
        409,
        "idempotency_in_flight",
      );
    }
    throw error;
  }
}

export async function updateAcpSession(input: {
  grant: AgentPrincipal;
  checkoutId: string;
  idempotencyKey: string;
  changes: {
    lineItems?: Array<{ id: string; quantity: number }>;
    couponCode?: string | null;
    buyer?: Record<string, unknown>;
    capabilities?: Record<string, unknown>;
  };
}) {
  const checkout = await db.agentCheckout.findFirst({
    where: { id: input.checkoutId, grantId: input.grant.id, protocol: "acp" },
  });
  if (!checkout) throw new AgentCheckoutError("Checkout session not found.", 404, "not_found");
  const started = await beginOperation({
    checkoutId: checkout.id,
    operation: "update",
    idempotencyKey: input.idempotencyKey,
    request: input.changes,
  });
  if (started.replayed) {
    return { response: started.operation.response, replayed: true };
  }
  if (checkout.status !== "DRAFT") {
    throw new AgentCheckoutError("Only draft checkout sessions can be updated.", 409);
  }
  const previous = checkout.request as unknown as AcpStoredRequest;
  const lineItems = input.changes.lineItems ?? previous.skus.map((id, index) => ({
    id,
    quantity: previous.native.lines[index]?.quantity ?? 1,
  }));
  const quote = await quoteAcpRequest(input.grant, {
    currency: checkout.currency,
    lineItems,
    couponCode:
      input.changes.couponCode === undefined
        ? previous.native.couponCode
        : input.changes.couponCode,
    buyer: input.changes.buyer ?? previous.buyer,
    capabilities: input.changes.capabilities ?? previous.capabilities,
  });
  await db.agentCheckout.update({
    where: { id: checkout.id },
    data: {
      request: quote.stored as unknown as Prisma.InputJsonValue,
      amount: quote.totals.total,
      baseAmount: quote.baseAmount,
    },
  });
  const response = await acpRepresentation(checkout.id);
  await db.agentCheckoutOperation.update({
    where: { id: started.operation.id },
    data: {
      response: response as unknown as Prisma.InputJsonValue,
      completedAt: new Date(),
    },
  });
  return { response, replayed: false };
}

export async function completeAcpSession(input: {
  grant: AgentPrincipal;
  checkoutId: string;
  idempotencyKey: string;
  token: string;
  ip: string | null;
}) {
  let checkout = await db.agentCheckout.findFirst({
    where: { id: input.checkoutId, grantId: input.grant.id, protocol: "acp" },
  });
  if (!checkout) throw new AgentCheckoutError("Checkout session not found.", 404, "not_found");
  const started = await beginOperation({
    checkoutId: checkout.id,
    operation: "complete",
    idempotencyKey: input.idempotencyKey,
    request: { tokenHash: sha256(input.token) },
  });
  if (started.replayed) {
    return { response: started.operation.response, replayed: true };
  }
  if (checkout.status === "CANCELED") {
    throw new AgentCheckoutError("Checkout session is canceled.", 409);
  }

  if (!checkout.invoiceId) {
    const stored = checkout.request as unknown as AcpStoredRequest;
    const native = await createNativeAgentCheckout({
      grant: input.grant,
      request: stored.native,
      idempotencyKey: `acp:${checkout.id}:${started.operation.id}`,
      ip: input.ip,
    });
    if (!native.orderId || !native.invoiceId) {
      throw new AgentCheckoutError("Order creation is still in progress.", 409);
    }
    const acpCheckoutId = checkout.id;
    checkout = await db.$transaction(async (tx) => {
      await tx.agentCheckout.delete({ where: { id: native.id } });
      return tx.agentCheckout.update({
        where: { id: acpCheckoutId },
        data: {
          orderId: native.orderId,
          invoiceId: native.invoiceId,
          status: native.status,
          amount: native.amount,
          baseAmount: native.baseAmount,
        },
      });
    });
  }

  if (checkout.status !== "PAID") {
    const [invoice, stripeExtension] = await Promise.all([
      db.invoice.findUnique({
        where: { id: checkout.invoiceId! },
        include: { user: true },
      }),
      db.extension.findUnique({ where: { slug: "stripe" } }),
    ]);
    const driver = getGatewayDriver("stripe");
    if (
      !invoice ||
      !stripeExtension?.enabled ||
      stripeExtension.type !== "GATEWAY" ||
      !driver?.chargeDelegated
    ) {
      throw new AgentCheckoutError(
        "Stripe delegated payments are not enabled.",
        503,
        "payment_unavailable",
      );
    }
    if (invoice.status !== "PAID") {
      const payment = await driver.chargeDelegated(
        invoice,
        input.token,
        extensionConfig(stripeExtension),
        `acp-${started.operation.id}`,
      );
      if (payment.status !== "succeeded") {
        throw new AgentCheckoutError(
          `Stripe payment requires attention (${payment.status}).`,
          402,
          "payment_not_completed",
        );
      }
      await markInvoicePaid(invoice.id, "stripe-acp", payment.transactionId);
    }
    checkout = await db.agentCheckout.update({
      where: { id: checkout.id },
      data: { status: "PAID" },
    });
  }

  const response = await acpRepresentation(checkout.id);
  await db.agentCheckoutOperation.update({
    where: { id: started.operation.id },
    data: {
      response: response as unknown as Prisma.InputJsonValue,
      completedAt: new Date(),
    },
  });
  return { response, replayed: false };
}

export async function cancelAcpSession(input: {
  grant: AgentPrincipal;
  checkoutId: string;
  idempotencyKey: string;
}) {
  const checkout = await db.agentCheckout.findFirst({
    where: { id: input.checkoutId, grantId: input.grant.id, protocol: "acp" },
  });
  if (!checkout) throw new AgentCheckoutError("Checkout session not found.", 404, "not_found");
  const started = await beginOperation({
    checkoutId: checkout.id,
    operation: "cancel",
    idempotencyKey: input.idempotencyKey,
    request: {},
  });
  if (started.replayed) return { response: started.operation.response, replayed: true };
  if (checkout.orderId || checkout.status === "PAID") {
    throw new AgentCheckoutError("A completed checkout cannot be canceled.", 409);
  }
  await db.agentCheckout.update({
    where: { id: checkout.id },
    data: { status: "CANCELED" },
  });
  const response = await acpRepresentation(checkout.id);
  await db.agentCheckoutOperation.update({
    where: { id: started.operation.id },
    data: { response: response as unknown as Prisma.InputJsonValue, completedAt: new Date() },
  });
  return { response, replayed: false };
}

function minor(amount: number): number {
  return Number(toAtomicUnits(roundCurrency(amount).toFixed(2), 2));
}

export async function acpRepresentation(checkoutId: string) {
  const checkout = await db.agentCheckout.findUnique({ where: { id: checkoutId } });
  if (!checkout) throw new AgentCheckoutError("Checkout session not found.", 404, "not_found");
  const stored = checkout.request as unknown as AcpStoredRequest;
  const [priced, baseUrl, stripeEnabled, order] = await Promise.all([
    priceCart(stored.native.lines),
    publicUrl(),
    db.extension.findFirst({ where: { slug: "stripe", type: "GATEWAY", enabled: true } }),
    checkout.orderId
      ? db.order.findUnique({ where: { id: checkout.orderId }, include: { items: { include: { product: true } } } })
      : null,
  ]);
  const currencies = await getEnabledCurrencies();
  const currency = currencies.find((item) => item.code === checkout.currency);
  if (!currency) throw new AgentCheckoutError("Checkout currency is unavailable.", 409);
  const lineItems = priced.map((line, index) => {
    const unit = roundCurrency(line.unitPrice * currency.rate);
    const lineTotal = roundCurrency(line.lineTotal * currency.rate);
    return {
      id: `line_${index + 1}`,
      item: { id: stored.skus[index], name: line.name, unit_amount: minor(unit) },
      product_id: line.productId,
      name: line.name,
      quantity: line.quantity,
      unit_amount: minor(unit),
      availability_status: "in_stock",
      totals: [
        { type: "items_base_amount", display_text: "Items", amount: minor(lineTotal) },
        { type: "subtotal", display_text: "Subtotal", amount: minor(lineTotal) },
        { type: "total", display_text: "Total", amount: minor(lineTotal) },
      ],
    };
  });
  const status = {
    DRAFT: "ready_for_payment",
    PROCESSING: "complete_in_progress",
    PAYMENT_PENDING: "in_progress",
    PAID: "completed",
    CANCELED: "canceled",
    FAILED: "requires_escalation",
  }[checkout.status];
  const response: Record<string, unknown> = {
    id: checkout.id,
    protocol: { version: ACP_VERSION },
    status,
    currency: checkout.currency.toLowerCase(),
    line_items: lineItems,
    totals: [
      { type: "subtotal", display_text: "Subtotal", amount: minor(Number(checkout.amount)) },
      { type: "total", display_text: "Total", amount: minor(Number(checkout.amount)) },
    ],
    fulfillment_options: [],
    messages: [],
    links: [],
    capabilities: {
      payment: {
        handlers: stripeEnabled
          ? [
              {
                id: "stripe_spt",
                name: "dev.acp.tokenized.card",
                display_name: "Card via Stripe",
                version: ACP_VERSION,
                spec: "https://docs.stripe.com/agentic-commerce/protocol",
                requires_delegate_payment: false,
                requires_pci_compliance: false,
                psp: "stripe",
                config_schema: "https://github.com/agentic-commerce-protocol/agentic-commerce-protocol",
                instrument_schemas: [
                  "https://github.com/agentic-commerce-protocol/agentic-commerce-protocol",
                ],
                config: {},
              },
            ]
          : [],
      },
    },
    buyer: stored.buyer,
    created_at: checkout.createdAt.toISOString(),
    updated_at: checkout.updatedAt.toISOString(),
    continue_url: checkout.invoiceId
      ? `${baseUrl}/dashboard/invoices/${checkout.invoiceId}`
      : `${baseUrl}/api/acp/checkout_sessions/${checkout.id}`,
  };
  if (checkout.status === "PAID" && order) {
    response.order = {
      id: order.id,
      order_number: String(order.number),
      checkout_session_id: checkout.id,
      status: "confirmed",
      currency: checkout.currency.toLowerCase(),
      total: minor(Number(checkout.amount)),
      line_items: order.items.map((item) => ({
        id: item.id,
        title: item.product.name,
        product_id: item.productId,
        quantity: {
          ordered: item.quantity,
          current: item.quantity,
          fulfilled: 0,
        },
        unit_price: minor(Number(item.unitPrice)),
        subtotal: minor(Number(item.unitPrice) * item.quantity + Number(item.setupFee)),
        status: "processing",
      })),
      created_at: order.createdAt.toISOString(),
      permalink_url: `${baseUrl}/dashboard/invoices/${checkout.invoiceId}`,
    };
  }
  return response;
}
