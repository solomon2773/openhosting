import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { convertToBase } from "@/lib/services/currency";
import type { Invoice, InvoiceItem, User } from "@/generated/prisma/client";

// Affiliate service: referral attribution and commission crediting.
// Commissions are held in the base currency (like account credit).

export const REF_COOKIE = "oh_ref";

export async function getOrCreateAffiliate(userId: string) {
  const existing = await db.affiliate.findUnique({ where: { userId } });
  if (existing) return existing;
  return db.affiliate.create({
    data: { userId, code: randomBytes(4).toString("hex") },
  });
}

export async function attributeReferral(
  userId: string,
  refCode: string | null,
): Promise<void> {
  if (!refCode) return;
  const affiliate = await db.affiliate.findUnique({ where: { code: refCode } });
  if (!affiliate || affiliate.userId === userId) return;
  await db.user.update({
    where: { id: userId },
    data: { referredByAffiliateId: affiliate.id },
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Credits commission for a paid invoice of a referred customer. Called from
// markInvoicePaid; a unique commission per invoice keeps it idempotent.
export async function creditCommission(
  invoice: Invoice & { user: User; items: InvoiceItem[] },
): Promise<void> {
  const settings = await getSettings([
    "affiliate_enabled",
    "affiliate_commission_type",
    "affiliate_commission_value",
    "affiliate_recurring",
    "currency",
  ]);
  if (settings.affiliate_enabled !== "true") return;
  if (!invoice.user.referredByAffiliateId) return;
  if (Number(invoice.total) <= 0) return;

  // idempotency: one commission per invoice
  const already = await db.affiliateCommission.findFirst({
    where: { invoiceId: invoice.id },
  });
  if (already) return;

  // one-time mode: only the referred customer's first paid invoice earns
  if (settings.affiliate_recurring !== "true") {
    const priorPaid = await db.invoice.count({
      where: {
        userId: invoice.userId,
        status: "PAID",
        id: { not: invoice.id },
      },
    });
    if (priorPaid > 0) return;
  }

  // per-product overrides where invoice items map to services/products;
  // fall back to the program default for the rest of the invoice total
  const defaultType = settings.affiliate_commission_type as "PERCENT" | "FIXED";
  const defaultValue = Number(settings.affiliate_commission_value);

  const serviceIds = invoice.items
    .map((i) => i.serviceId)
    .filter((id): id is string => Boolean(id));
  const services = serviceIds.length
    ? await db.service.findMany({
        where: { id: { in: serviceIds } },
        include: { product: true },
      })
    : [];

  let commissionInInvoiceCurrency = 0;
  let coveredAmount = 0;
  for (const item of invoice.items) {
    const service = services.find((s) => s.id === item.serviceId);
    const product = service?.product;
    if (product?.affiliateCommissionType && product.affiliateCommissionValue) {
      const lineTotal = Number(item.unitPrice) * item.quantity;
      coveredAmount += lineTotal;
      commissionInInvoiceCurrency +=
        product.affiliateCommissionType === "PERCENT"
          ? (lineTotal * Number(product.affiliateCommissionValue)) / 100
          : Number(product.affiliateCommissionValue);
    }
  }
  const remainder = Math.max(0, Number(invoice.total) - coveredAmount);
  if (remainder > 0) {
    commissionInInvoiceCurrency +=
      defaultType === "PERCENT"
        ? (remainder * defaultValue) / 100
        : coveredAmount === 0
          ? defaultValue
          : 0;
  }
  if (commissionInInvoiceCurrency <= 0) return;

  const amountBase =
    invoice.currency === settings.currency
      ? round2(commissionInInvoiceCurrency)
      : await convertToBase(commissionInInvoiceCurrency, invoice.currency);

  await db.$transaction([
    db.affiliateCommission.create({
      data: {
        affiliateId: invoice.user.referredByAffiliateId,
        referredUserId: invoice.userId,
        invoiceId: invoice.id,
        amount: amountBase,
      },
    }),
    db.affiliate.update({
      where: { id: invoice.user.referredByAffiliateId },
      data: {
        balance: { increment: amountBase },
        totalEarned: { increment: amountBase },
      },
    }),
  ]);
}
