import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withApiKey } from "@/lib/api-auth";

export const GET = withApiKey("coupons:read", async () => {
  const coupons = await db.coupon.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({
    data: coupons.map((c) => ({
      id: c.id,
      code: c.code,
      type: c.type,
      value: Number(c.value),
      max_uses: c.maxUses,
      uses: c.uses,
      expires_at: c.expiresAt,
    })),
  });
});

const createSchema = z.object({
  code: z.string().min(1),
  type: z.enum(["PERCENT", "FIXED"]),
  value: z.number().nonnegative(),
  max_uses: z.number().int().positive().optional(),
  expires_at: z.string().optional(),
});

export const POST = withApiKey("coupons:write", async (request) => {
  const body = createSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: body.error.issues },
      { status: 422 },
    );
  }
  const coupon = await db.coupon.create({
    data: {
      code: body.data.code.toUpperCase(),
      type: body.data.type,
      value: body.data.value,
      maxUses: body.data.max_uses ?? null,
      expiresAt: body.data.expires_at ? new Date(body.data.expires_at) : null,
    },
  });
  return NextResponse.json({ data: { id: coupon.id, code: coupon.code } }, { status: 201 });
});
