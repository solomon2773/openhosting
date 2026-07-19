import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withApiKey } from "@/lib/api-auth";

export const GET = withApiKey("orders:read", async (request) => {
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const perPage = Math.min(100, Number(url.searchParams.get("per_page") ?? 25));
  const [total, orders] = await Promise.all([
    db.order.count(),
    db.order.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: { user: true, items: { include: { product: true } } },
    }),
  ]);
  return NextResponse.json({
    data: orders.map((order) => ({
      id: order.id,
      number: order.number,
      user_id: order.userId,
      user_email: order.user.email,
      status: order.status,
      currency: order.currency,
      total: Number(order.total),
      created_at: order.createdAt,
      items: order.items.map((item) => ({
        product: item.product.slug,
        cycle: item.cycle,
        quantity: item.quantity,
        unit_price: Number(item.unitPrice),
      })),
    })),
    meta: { page, per_page: perPage, total },
  });
});
