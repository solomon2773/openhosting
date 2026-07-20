import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withApiKey } from "@/lib/api-auth";

export const GET = withApiKey("services:read", async (request) => {
  const url = new URL(request.url);
  const status = url.searchParams.get("status")?.toUpperCase();
  const userId = url.searchParams.get("user_id");
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const perPage = Math.min(100, Number(url.searchParams.get("per_page") ?? 25));
  const where = {
    ...(status &&
    ["PENDING", "ACTIVE", "SUSPENDED", "CANCELLED", "EXPIRED"].includes(status)
      ? { status: status as never }
      : {}),
    ...(userId ? { userId } : {}),
  };
  const [total, services] = await Promise.all([
    db.service.count({ where }),
    db.service.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: { product: true, user: true },
    }),
  ]);
  return NextResponse.json({
    data: services.map((s) => ({
      id: s.id,
      user_id: s.userId,
      user_email: s.user.email,
      product: s.product.slug,
      status: s.status,
      cycle: s.cycle,
      price: Number(s.price),
      currency: s.currency,
      metered: s.product.metered,
      external_id: s.externalId,
      expires_at: s.expiresAt,
      created_at: s.createdAt,
    })),
    meta: { page, per_page: perPage, total },
  });
});
