import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { notFoundJson, withApiKey } from "@/lib/api-auth";
import {
  provisionSuspend,
  provisionUnsuspend,
  provisionTerminate,
} from "@/lib/services/provisioning";

const serviceInclude = {
  user: true,
  product: { include: { serverExtension: true } },
} as const;

export const GET = withApiKey("services:read", async (_request, { params }) => {
  const service = await db.service.findUnique({
    where: { id: params.id },
    include: { product: true, user: true, usageRecords: { where: { billed: false } } },
  });
  if (!service) return notFoundJson();
  return NextResponse.json({
    data: {
      id: service.id,
      user_id: service.userId,
      product: service.product.slug,
      status: service.status,
      cycle: service.cycle,
      price: Number(service.price),
      external_id: service.externalId,
      expires_at: service.expiresAt,
      unbilled_usage: service.usageRecords.reduce(
        (sum, r) => sum + Number(r.quantity),
        0,
      ),
    },
  });
});

const actionSchema = z.object({
  action: z.enum(["suspend", "unsuspend", "terminate"]),
});

// Perform a lifecycle action on a service.
export const POST = withApiKey("services:write", async (request, { params }) => {
  const body = actionSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: body.error.issues },
      { status: 422 },
    );
  }
  const service = await db.service.findUnique({
    where: { id: params.id },
    include: serviceInclude,
  });
  if (!service) return notFoundJson();

  switch (body.data.action) {
    case "suspend":
      await db.service.update({
        where: { id: service.id },
        data: { status: "SUSPENDED", suspendedAt: new Date() },
      });
      await provisionSuspend(service);
      break;
    case "unsuspend":
      await db.service.update({
        where: { id: service.id },
        data: { status: "ACTIVE", suspendedAt: null },
      });
      await provisionUnsuspend(service);
      break;
    case "terminate":
      await db.service.update({
        where: { id: service.id },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });
      await provisionTerminate(service);
      break;
  }
  return NextResponse.json({ data: { action: body.data.action, ok: true } });
});
