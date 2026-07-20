"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { sendMail } from "@/lib/mail";
import { audit } from "@/lib/audit";
import { formatMoney } from "@/lib/format";
import type { FormState } from "@/lib/actions/auth";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

// ── Admin: create / send quotes ─────────────────────────────────────────────

export async function createQuote(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin("quotes");
  const userId = str(formData, "userId");
  if (!userId) return { error: "Select a customer." };

  // line items arrive as parallel arrays desc[], qty[], price[]
  const descriptions = formData.getAll("desc").map(String);
  const quantities = formData.getAll("qty").map((v) => Number(v) || 1);
  const prices = formData.getAll("price").map((v) => Number(v) || 0);
  const items = descriptions
    .map((description, i) => ({
      description: description.trim(),
      quantity: quantities[i] ?? 1,
      unitPrice: prices[i] ?? 0,
    }))
    .filter((it) => it.description && it.unitPrice >= 0);
  if (items.length === 0) return { error: "Add at least one line item." };

  const settings = await getSettings(["currency"]);
  const subtotal = items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
  const validRaw = str(formData, "validUntil");

  const quote = await db.quote.create({
    data: {
      userId,
      status: "DRAFT",
      currency: settings.currency,
      subtotal,
      total: subtotal,
      notes: str(formData, "notes") || null,
      validUntil: validRaw ? new Date(validRaw) : null,
      items: { create: items },
    },
  });
  await audit("admin.quote_created", {
    userId: admin.id,
    targetType: "quote",
    targetId: quote.id,
  });
  redirect(`/admin/quotes/${quote.id}`);
}

export async function sendQuote(formData: FormData): Promise<void> {
  const admin = await requireAdmin("quotes");
  const id = str(formData, "id");
  const quote = await db.quote.update({
    where: { id },
    data: { status: "SENT" },
    include: { user: true },
  });
  const settings = await getSettings(["company_name", "company_url"]);
  await sendMail(
    quote.user.email,
    `Quote #${quote.number} from ${settings.company_name}`,
    `<p>Hi ${quote.user.firstName},</p><p>We've prepared quote <strong>#${quote.number}</strong> for ${formatMoney(quote.total, quote.currency)}. Review and accept it at <a href="${settings.company_url}/dashboard/quotes/${quote.id}">${settings.company_url}/dashboard/quotes/${quote.id}</a>.</p>`,
  );
  await audit("admin.quote_sent", { userId: admin.id, targetId: id });
  revalidatePath(`/admin/quotes/${id}`);
}

export async function deleteQuote(formData: FormData): Promise<void> {
  await requireAdmin("quotes");
  await db.quote.delete({ where: { id: str(formData, "id") } });
  redirect("/admin/quotes");
}

// ── Customer: accept / decline ──────────────────────────────────────────────

export async function acceptQuote(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = str(formData, "id");
  const quote = await db.quote.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!quote || quote.userId !== user.id) redirect("/dashboard/quotes");
  if (quote.status !== "SENT") redirect(`/dashboard/quotes/${id}`);
  if (quote.validUntil && quote.validUntil < new Date()) {
    await db.quote.update({ where: { id }, data: { status: "EXPIRED" } });
    redirect(`/dashboard/quotes/${id}`);
  }

  // convert the quote into an invoice
  const invoice = await db.invoice.create({
    data: {
      userId: quote.userId,
      currency: quote.currency,
      subtotal: quote.subtotal,
      tax: quote.tax,
      total: quote.total,
      dueAt: new Date(),
      items: {
        create: quote.items.map((it) => ({
          description: it.description,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
        })),
      },
    },
  });
  await db.quote.update({
    where: { id },
    data: { status: "ACCEPTED", invoiceId: invoice.id },
  });
  await audit("quote.accepted", {
    userId: user.id,
    targetType: "quote",
    targetId: id,
  });
  redirect(`/dashboard/invoices/${invoice.id}`);
}

export async function declineQuote(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = str(formData, "id");
  const quote = await db.quote.findUnique({ where: { id } });
  if (!quote || quote.userId !== user.id) redirect("/dashboard/quotes");
  await db.quote.update({ where: { id }, data: { status: "DECLINED" } });
  revalidatePath(`/dashboard/quotes/${id}`);
}
