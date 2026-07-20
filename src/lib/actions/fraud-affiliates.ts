"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { activateApprovedOrder } from "@/lib/billing";
import { validateVatId, isEuCountry } from "@/lib/services/fraud";
import { getOrCreateAffiliate } from "@/lib/services/affiliates";
import type { BanType } from "@/generated/prisma/client";
import type { FormState } from "@/lib/actions/auth";

// ── Ban rules (admin) ───────────────────────────────────────────────────────

export async function addBanRule(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin("fraud");
  const type = String(formData.get("type") ?? "") as BanType;
  const value = String(formData.get("value") ?? "").trim().toLowerCase();
  if (!value) return { error: "Value is required." };
  await db.banRule.upsert({
    where: { type_value: { type, value } },
    update: { reason: String(formData.get("reason") ?? "") || null },
    create: { type, value, reason: String(formData.get("reason") ?? "") || null },
  });
  revalidatePath("/admin/fraud");
  return { success: "Ban rule added." };
}

export async function deleteBanRule(formData: FormData): Promise<void> {
  await requireAdmin("fraud");
  await db.banRule.delete({ where: { id: String(formData.get("id") ?? "") } });
  revalidatePath("/admin/fraud");
}

// ── Order review queue (admin) ──────────────────────────────────────────────

export async function approveOrder(formData: FormData): Promise<void> {
  const admin = await requireAdmin("orders");
  const id = String(formData.get("id") ?? "");
  await db.order.update({
    where: { id },
    data: { reviewStatus: "APPROVED" },
  });
  // provision anything the customer already paid for while under review
  await activateApprovedOrder(id);
  await audit("admin.order_approved", { userId: admin.id, targetId: id });
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin/fraud");
}

export async function rejectOrder(formData: FormData): Promise<void> {
  const admin = await requireAdmin("orders");
  const id = String(formData.get("id") ?? "");
  await db.order.update({
    where: { id },
    data: { reviewStatus: "REJECTED", status: "CANCELLED" },
  });
  await db.service.updateMany({
    where: { orderId: id, status: "PENDING" },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });
  await db.invoice.updateMany({
    where: { orderId: id, status: "PENDING" },
    data: { status: "CANCELLED" },
  });
  await audit("admin.order_rejected", { userId: admin.id, targetId: id });
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin/fraud");
}

// ── VAT (client) ────────────────────────────────────────────────────────────

export async function saveVatId(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const vatId = String(formData.get("vatId") ?? "").trim();
  if (!vatId) {
    await db.user.update({
      where: { id: user.id },
      data: { vatId: null, vatValidatedAt: null },
    });
    return { success: "VAT ID removed." };
  }
  if (!user.country || !isEuCountry(user.country)) {
    return { error: "Set an EU country on your profile first." };
  }
  const valid = await validateVatId(user.country, vatId);
  await db.user.update({
    where: { id: user.id },
    data: { vatId, vatValidatedAt: valid ? new Date() : null },
  });
  revalidatePath("/dashboard/account");
  return valid
    ? { success: "VAT ID validated via VIES — reverse charge applies where eligible." }
    : { error: "VIES could not validate this VAT ID. It was saved but tax will still be charged." };
}

// ── Affiliates ──────────────────────────────────────────────────────────────

export async function joinAffiliateProgram(): Promise<void> {
  const user = await requireUser();
  await getOrCreateAffiliate(user.id);
  await audit("affiliate.joined", { userId: user.id });
  revalidatePath("/dashboard/affiliate");
}

export async function markAffiliatePaid(formData: FormData): Promise<void> {
  const admin = await requireAdmin("affiliates");
  const id = String(formData.get("id") ?? "");
  await db.$transaction([
    db.affiliateCommission.updateMany({
      where: { affiliateId: id, status: "EARNED" },
      data: { status: "PAID" },
    }),
    db.affiliate.update({ where: { id }, data: { balance: 0 } }),
  ]);
  await audit("admin.affiliate_paid", { userId: admin.id, targetId: id });
  revalidatePath("/admin/affiliates");
}
