import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withApiKey } from "@/lib/api-auth";

export const GET = withApiKey("tickets:read", async (request) => {
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const perPage = Math.min(100, Number(url.searchParams.get("per_page") ?? 25));
  const [total, tickets] = await Promise.all([
    db.ticket.count(),
    db.ticket.findMany({
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: { user: true },
    }),
  ]);
  return NextResponse.json({
    data: tickets.map((ticket) => ({
      id: ticket.id,
      number: ticket.number,
      subject: ticket.subject,
      status: ticket.status,
      priority: ticket.priority,
      department: ticket.department,
      user_email: ticket.user.email,
      updated_at: ticket.updatedAt,
    })),
    meta: { page, per_page: perPage, total },
  });
});

const createSchema = z.object({
  user_id: z.string(),
  subject: z.string().min(3),
  message: z.string().min(1),
  department: z.string().default("general"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
});

export const POST = withApiKey("tickets:write", async (request) => {
  const body = createSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: body.error.issues },
      { status: 422 },
    );
  }
  const ticket = await db.ticket.create({
    data: {
      userId: body.data.user_id,
      subject: body.data.subject,
      department: body.data.department,
      priority: body.data.priority,
      messages: {
        create: { userId: body.data.user_id, message: body.data.message },
      },
    },
  });
  return NextResponse.json(
    { data: { id: ticket.id, number: ticket.number } },
    { status: 201 },
  );
});
