import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateAgentGrant } from "@/lib/agent-auth";
import { acpError, acpResponse, validateAcpRequest } from "@/lib/acp-http";
import { acpRepresentation, updateAcpSession } from "@/lib/services/acp";
import { db } from "@/lib/db";

const updateSchema = z.object({
  line_items: z
    .array(z.object({ id: z.string().min(1), quantity: z.number().int().min(1).max(100) }))
    .min(1)
    .max(50)
    .optional(),
  capabilities: z.record(z.string(), z.unknown()).optional(),
  buyer: z.record(z.string(), z.unknown()).optional(),
  coupons: z.array(z.string()).max(1).optional(),
  discounts: z.object({ codes: z.array(z.string()).max(1).optional() }).optional(),
}).passthrough();

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const grant = await authenticateAgentGrant(request);
  if (!grant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const headers = validateAcpRequest(request, false);
  if (headers.response) return headers.response;
  const { id } = await context.params;
  const exists = await db.agentCheckout.findFirst({
    where: { id, grantId: grant.id, protocol: "acp" },
    select: { id: true },
  });
  if (!exists) {
    return acpResponse(
      { type: "invalid_request_error", code: "not_found", message: "Checkout session not found." },
      { status: 404 },
    );
  }
  try {
    return acpResponse(await acpRepresentation(id));
  } catch (error) {
    return acpError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const grant = await authenticateAgentGrant(request);
  if (!grant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const headers = validateAcpRequest(request);
  if (headers.response) return headers.response;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return acpResponse(
      { type: "invalid_request_error", code: "invalid_request", message: "Invalid ACP update request.", details: parsed.error.issues },
      { status: 422 },
    );
  }
  const { id } = await context.params;
  try {
    const result = await updateAcpSession({
      grant,
      checkoutId: id,
      idempotencyKey: headers.idempotencyKey!,
      changes: {
        lineItems: parsed.data.line_items,
        buyer: parsed.data.buyer,
        capabilities: parsed.data.capabilities,
        couponCode:
          parsed.data.discounts?.codes?.[0] ?? parsed.data.coupons?.[0] ?? undefined,
      },
    });
    return acpResponse(result.response, {
      idempotencyKey: headers.idempotencyKey,
      replayed: result.replayed,
    });
  } catch (error) {
    return acpError(error);
  }
}
