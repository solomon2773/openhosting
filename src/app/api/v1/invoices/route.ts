import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withApiKey } from "@/lib/api-auth";

export const GET = withApiKey("invoices:read", async (request) => {
  const url = new URL(request.url);
  const status = url.searchParams.get("status")?.toUpperCase();
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const perPage = Math.min(100, Number(url.searchParams.get("per_page") ?? 25));
  const where =
    status && ["PENDING", "PAID", "CANCELLED", "REFUNDED"].includes(status)
      ? { status: status as never }
      : undefined;
  const [total, invoices] = await Promise.all([
    db.invoice.count({ where }),
    db.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: { user: true, items: true },
    }),
  ]);
  return NextResponse.json({
    data: invoices.map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      user_id: invoice.userId,
      user_email: invoice.user.email,
      status: invoice.status,
      currency: invoice.currency,
      total: Number(invoice.total),
      due_at: invoice.dueAt,
      paid_at: invoice.paidAt,
      items: invoice.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: Number(item.unitPrice),
      })),
    })),
    meta: { page, per_page: perPage, total },
  });
});
