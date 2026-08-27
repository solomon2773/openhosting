import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateAgentGrant } from "@/lib/agent-auth";
import { acpError, acpResponse, validateAcpRequest } from "@/lib/acp-http";
import { createAcpSession, acpRepresentation } from "@/lib/services/acp";

const schema = z.object({
  line_items: z
    .array(z.object({ id: z.string().min(1), quantity: z.number().int().min(1).max(100) }))
    .min(1)
    .max(50),
  currency: z.string().length(3),
  capabilities: z.record(z.string(), z.unknown()),
  buyer: z.record(z.string(), z.unknown()).optional(),
  coupons: z.array(z.string()).max(1).optional(),
  discounts: z.object({ codes: z.array(z.string()).max(1).optional() }).optional(),
}).passthrough();

export async function POST(request: Request) {
  const grant = await authenticateAgentGrant(request);
  if (!grant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const headers = validateAcpRequest(request);
  if (headers.response) return headers.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return acpResponse(
      { type: "invalid_request_error", code: "invalid_request", message: "Invalid ACP checkout request.", details: parsed.error.issues },
      { status: 422 },
    );
  }
  try {
    const created = await createAcpSession({
      grant,
      idempotencyKey: headers.idempotencyKey!,
      request: {
        currency: parsed.data.currency,
        lineItems: parsed.data.line_items,
        couponCode: parsed.data.discounts?.codes?.[0] ?? parsed.data.coupons?.[0] ?? null,
        buyer: parsed.data.buyer,
        capabilities: parsed.data.capabilities,
      },
    });
    return acpResponse(await acpRepresentation(created.checkout.id), {
      status: 201,
      idempotencyKey: headers.idempotencyKey,
      replayed: created.replayed,
    });
  } catch (error) {
    return acpError(error);
  }
}
