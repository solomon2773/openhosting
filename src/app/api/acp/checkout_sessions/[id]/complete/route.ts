import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateAgentGrant } from "@/lib/agent-auth";
import { acpError, acpResponse, validateAcpRequest } from "@/lib/acp-http";
import { completeAcpSession } from "@/lib/services/acp";

const schema = z.object({
  payment_data: z.object({
    handler_id: z.literal("stripe_spt"),
    instrument: z.object({
      type: z.string(),
      credential: z.object({ type: z.literal("spt"), token: z.string().min(1).max(1_000) }),
    }),
  }),
}).passthrough();

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const grant = await authenticateAgentGrant(request);
  if (!grant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const headers = validateAcpRequest(request);
  if (headers.response) return headers.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return acpResponse(
      { type: "invalid_request_error", code: "invalid_payment_data", message: "A Stripe SPT credential is required.", details: parsed.error.issues },
      { status: 422 },
    );
  }
  const { id } = await context.params;
  try {
    const result = await completeAcpSession({
      grant,
      checkoutId: id,
      idempotencyKey: headers.idempotencyKey!,
      token: parsed.data.payment_data.instrument.credential.token,
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });
    return acpResponse(result.response, {
      idempotencyKey: headers.idempotencyKey,
      replayed: result.replayed,
    });
  } catch (error) {
    return acpError(error);
  }
}
