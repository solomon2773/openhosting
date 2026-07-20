import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withApiKey } from "@/lib/api-auth";
import { getSettings } from "@/lib/settings";

export const GET = withApiKey("quotes:read", async (request) => {
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const perPage = Math.min(100, Number(url.searchParams.get("per_page") ?? 25));
  const [total, quotes] = await Promise.all([
    db.quote.count(),
    db.quote.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: { user: true },
    }),
  ]);
  return NextResponse.json({
    data: quotes.map((q) => ({
      id: q.id,
      number: q.number,
      user_id: q.userId,
      user_email: q.user.email,
      status: q.status,
      currency: q.currency,
      total: Number(q.total),
      valid_until: q.validUntil,
      invoice_id: q.invoiceId,
    })),
    meta: { page, per_page: perPage, total },
  });
});

const createSchema = z.object({
  user_id: z.string(),
  notes: z.string().optional(),
  valid_until: z.string().optional(),
  items: z
    .array(
      z.object({
        description: z.string().min(1),
        quantity: z.number().int().positive().default(1),
        unit_price: z.number().nonnegative(),
      }),
    )
    .min(1),
});

export const POST = withApiKey("quotes:write", async (request) => {
  const body = createSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: body.error.issues },
      { status: 422 },
    );
  }
  const settings = await getSettings(["currency"]);
  const subtotal = body.data.items.reduce(
    (s, it) => s + it.unit_price * it.quantity,
    0,
  );
  const quote = await db.quote.create({
    data: {
      userId: body.data.user_id,
      currency: settings.currency,
      subtotal,
      total: subtotal,
      notes: body.data.notes ?? null,
      validUntil: body.data.valid_until ? new Date(body.data.valid_until) : null,
      items: {
        create: body.data.items.map((it) => ({
          description: it.description,
          quantity: it.quantity,
          unitPrice: it.unit_price,
        })),
      },
    },
  });
  return NextResponse.json(
    { data: { id: quote.id, number: quote.number } },
    { status: 201 },
  );
});
