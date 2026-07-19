import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notFoundJson, withApiKey } from "@/lib/api-auth";

export const GET = withApiKey("users:read", async (_request, { params }) => {
  const user = await db.user.findUnique({
    where: { id: params.id },
    include: {
      services: { include: { product: true } },
      _count: { select: { invoices: true, tickets: true } },
    },
  });
  if (!user) return notFoundJson();
  return NextResponse.json({
    data: {
      id: user.id,
      email: user.email,
      first_name: user.firstName,
      last_name: user.lastName,
      country: user.country,
      credits: Number(user.credits),
      created_at: user.createdAt,
      services: user.services.map((s) => ({
        id: s.id,
        product: s.product.name,
        status: s.status,
        expires_at: s.expiresAt,
      })),
      invoice_count: user._count.invoices,
      ticket_count: user._count.tickets,
    },
  });
});
