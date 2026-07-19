import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withApiKey } from "@/lib/api-auth";

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
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const perPage = Math.min(100, Number(url.searchParams.get("per_page") ?? 25));
  const [total, users] = await Promise.all([
    db.user.count(),
    db.user.findMany({
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
