import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withApiKey } from "@/lib/api-auth";
import { hashPassword } from "@/lib/auth";

const serialize = (user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  country: string | null;
  credits: unknown;
  createdAt: Date;
}) => ({
  id: user.id,
  email: user.email,
  first_name: user.firstName,
  last_name: user.lastName,
  country: user.country,
  credits: Number(user.credits),
  created_at: user.createdAt,
});

export const GET = withApiKey("users:read", async (request) => {
  const url = new URL(request.url);
  const q = url.searchParams.get("q");
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const perPage = Math.min(100, Number(url.searchParams.get("per_page") ?? 25));
  const where = q
    ? {
        OR: [
          { email: { contains: q, mode: "insensitive" as const } },
          { firstName: { contains: q, mode: "insensitive" as const } },
          { lastName: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};
  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ]);
  return NextResponse.json({
    data: users.map(serialize),
    meta: { page, per_page: perPage, total },
  });
});

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  country: z.string().optional(),
});

// Create a customer account.
export const POST = withApiKey("users:write", async (request) => {
  const body = createSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: body.error.issues },
      { status: 422 },
    );
  }
  const email = body.data.email.toLowerCase();
  if (await db.user.findUnique({ where: { email } })) {
    return NextResponse.json(
      { error: "Email already exists" },
      { status: 409 },
    );
  }
  const user = await db.user.create({
    data: {
      email,
      password: await hashPassword(body.data.password),
      firstName: body.data.first_name,
      lastName: body.data.last_name,
      country: body.data.country ?? null,
      emailVerifiedAt: new Date(),
    },
  });
  return NextResponse.json({ data: serialize(user) }, { status: 201 });
});
