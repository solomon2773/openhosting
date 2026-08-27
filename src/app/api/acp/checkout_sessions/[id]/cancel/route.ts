import { NextResponse } from "next/server";
import { authenticateAgentGrant } from "@/lib/agent-auth";
import { acpError, acpResponse, validateAcpRequest } from "@/lib/acp-http";
import { cancelAcpSession } from "@/lib/services/acp";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const grant = await authenticateAgentGrant(request);
  if (!grant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const headers = validateAcpRequest(request);
  if (headers.response) return headers.response;
  const { id } = await context.params;
  try {
    const result = await cancelAcpSession({
      grant,
      checkoutId: id,
      idempotencyKey: headers.idempotencyKey!,
    });
    return acpResponse(result.response, {
      idempotencyKey: headers.idempotencyKey,
      replayed: result.replayed,
    });
  } catch (error) {
    return acpError(error);
  }
}
