import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { authenticateAgentGrant } from "@/lib/agent-auth";
import { getUser, sha256 } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { extensionConfig } from "@/lib/extensions/types";
import { getChargeCurrency } from "@/lib/services/currency";
import { markInvoicePaid } from "@/lib/billing";
import { publicUrl } from "@/lib/settings";
import { canonicalJson } from "@/lib/agent-commerce-policy";
import {
  decodeX402Header,
  encodeX402Header,
  paymentPayloadMatches,
  verifyAndSettleX402,
  x402PaymentRequired,
  type X402Config,
} from "@/lib/x402";

const NO_STORE = { "Cache-Control": "no-store" };

function json402(required: ReturnType<typeof x402PaymentRequired>) {
  return NextResponse.json(required, {
    status: 402,
    headers: { ...NO_STORE, "PAYMENT-REQUIRED": encodeX402Header(required) },
  });
}

function prismaCode(error: unknown): string | null {
  return typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : null;
}

async function finalizeX402Invoice(input: {
  invoiceId: string;
  userId: string;
  response: Awaited<ReturnType<typeof verifyAndSettleX402>>;
  auditPayment: boolean;
}) {
  await markInvoicePaid(input.invoiceId, "x402", input.response.transaction);
  const checkouts = await db.agentCheckout.updateMany({
    where: { invoiceId: input.invoiceId, status: { not: "PAID" } },
    data: { status: "PAID" },
  });
  if (input.auditPayment || checkouts.count > 0) {
    await audit("payment.x402_settled", {
      userId: input.userId,
      targetType: "invoice",
      targetId: input.invoiceId,
      metadata: {
        network: input.response.network,
        transaction: input.response.transaction,
      },
    });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const grant = await authenticateAgentGrant(request);
  const sessionUser = grant ? null : await getUser();
  const [invoice, extension, baseUrl] = await Promise.all([
    db.invoice.findUnique({ where: { id } }),
    db.extension.findUnique({ where: { slug: "x402" } }),
    publicUrl(),
  ]);
  const userId = grant?.userId ?? sessionUser?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }
  if (!invoice || invoice.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }
  if (!extension?.enabled || extension.type !== "GATEWAY") {
    return NextResponse.json(
      { error: "x402 payments are not enabled" },
      { status: 503, headers: NO_STORE },
    );
  }

  const currency = await getChargeCurrency(invoice.currency);
  const config = extensionConfig(extension) as X402Config;
  if (
    invoice.currency !== "USDC" ||
    currency?.kind !== "STABLECOIN" ||
    currency.decimals !== 6 ||
    !currency.settlementNetworks.includes(config.network)
  ) {
    return NextResponse.json(
      { error: "This invoice is not payable on the configured USDC network" },
      { status: 409, headers: NO_STORE },
    );
  }

  const resourceUrl = `${baseUrl}/api/x402/invoices/${invoice.id}`;
  let required;
  try {
    required = x402PaymentRequired({ invoice, config, resourceUrl });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid x402 configuration" },
      { status: 503, headers: NO_STORE },
    );
  }
  const requirements = required.accepts[0];

  const completed = await db.x402Settlement.findUnique({
    where: { invoiceId: invoice.id },
  });
  if (invoice.status === "PAID" && completed?.status === "SETTLED") {
    const response = completed.response as Record<string, unknown>;
    await db.agentCheckout.updateMany({
      where: { invoiceId: invoice.id, status: { not: "PAID" } },
      data: { status: "PAID" },
    });
    return NextResponse.json(
      { data: { invoice_id: invoice.id, status: "paid" } },
      { headers: { ...NO_STORE, "PAYMENT-RESPONSE": encodeX402Header(response) } },
    );
  }
  if (invoice.status !== "PENDING") {
    return NextResponse.json(
      { error: "Invoice is not payable" },
      { status: 409, headers: NO_STORE },
    );
  }

  const signatureHeader = request.headers.get("payment-signature");
  if (!signatureHeader) return json402(required);

  let paymentPayload: Record<string, unknown>;
  try {
    paymentPayload = decodeX402Header(signatureHeader);
  } catch (error) {
    return json402(
      x402PaymentRequired({
        invoice,
        config,
        resourceUrl,
        error: error instanceof Error ? error.message : "Invalid payment payload",
      }),
    );
  }
  if (!paymentPayloadMatches(paymentPayload, resourceUrl, requirements)) {
    return json402(
      x402PaymentRequired({
        invoice,
        config,
        resourceUrl,
        error: "Payment payload does not match this invoice's exact terms",
      }),
    );
  }

  const signatureHash = sha256(signatureHeader);
  const requirementsHash = sha256(canonicalJson(requirements));
  let settlement = completed;
  if (settlement) {
    if (
      settlement.paymentSignatureHash !== signatureHash ||
      settlement.requirementsHash !== requirementsHash
    ) {
      return NextResponse.json(
        { error: "A different payment is already associated with this invoice" },
        { status: 409, headers: NO_STORE },
      );
    }
    if (settlement.status === "SETTLED") {
      const response = settlement.response as Awaited<
        ReturnType<typeof verifyAndSettleX402>
      >;
      await finalizeX402Invoice({ invoiceId: invoice.id, userId, response, auditPayment: true });
      return NextResponse.json(
        { data: { invoice_id: invoice.id, status: "paid" } },
        { headers: { ...NO_STORE, "PAYMENT-RESPONSE": encodeX402Header(response) } },
      );
    }
    const stale = settlement.updatedAt.getTime() < Date.now() - 120_000;
    if (settlement.status === "VERIFYING" && !stale) {
      return NextResponse.json(
        { error: "Payment verification is already in progress" },
        { status: 409, headers: { ...NO_STORE, "Retry-After": "2" } },
      );
    }
    const claimed = await db.x402Settlement.updateMany({
      where: { id: settlement.id, status: settlement.status, updatedAt: settlement.updatedAt },
      data: { status: "VERIFYING", error: null },
    });
    if (claimed.count === 0) {
      return NextResponse.json(
        { error: "Payment verification is already in progress" },
        { status: 409, headers: { ...NO_STORE, "Retry-After": "2" } },
      );
    }
  } else {
    try {
      settlement = await db.x402Settlement.create({
        data: {
          invoiceId: invoice.id,
          paymentSignatureHash: signatureHash,
          requirementsHash,
          network: requirements.network,
        },
      });
    } catch (error) {
      if (prismaCode(error) === "P2002") {
        return NextResponse.json(
          { error: "Payment verification is already in progress" },
          { status: 409, headers: { ...NO_STORE, "Retry-After": "2" } },
        );
      }
      throw error;
    }
  }

  let response: Awaited<ReturnType<typeof verifyAndSettleX402>>;
  try {
    response = await verifyAndSettleX402({
      config,
      paymentPayload,
      paymentRequirements: requirements,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment settlement failed";
    await db.x402Settlement.update({
      where: { id: settlement.id },
      data: { status: "FAILED", error: message.slice(0, 1_000) },
    });
    return json402(
      x402PaymentRequired({ invoice, config, resourceUrl, error: message }),
    );
  }

  try {
    await db.x402Settlement.update({
      where: { id: settlement.id },
      data: {
        status: "SETTLED",
        transaction: response.transaction,
        payer: response.payer,
        response: response as unknown as Prisma.InputJsonValue,
      },
    });
  } catch {
    // Settlement has already happened externally. Do not downgrade it to a
    // failed payment or issue a fresh 402 just because local persistence needs
    // to be retried with the same signed payload.
    return NextResponse.json(
      { error: "Payment settled; settlement recording is pending", retryable: true },
      {
        status: 503,
        headers: { ...NO_STORE, "PAYMENT-RESPONSE": encodeX402Header(response) },
      },
    );
  }

  try {
    await finalizeX402Invoice({ invoiceId: invoice.id, userId, response, auditPayment: true });
  } catch {
    // The on-chain settlement is final. Preserve it as SETTLED so a retry can
    // finish local invoice side effects without requesting a second payment.
    return NextResponse.json(
      { error: "Payment settled; invoice finalization is pending", retryable: true },
      {
        status: 503,
        headers: { ...NO_STORE, "PAYMENT-RESPONSE": encodeX402Header(response) },
      },
    );
  }
  return NextResponse.json(
    { data: { invoice_id: invoice.id, status: "paid" } },
    { headers: { ...NO_STORE, "PAYMENT-RESPONSE": encodeX402Header(response) } },
  );
}
