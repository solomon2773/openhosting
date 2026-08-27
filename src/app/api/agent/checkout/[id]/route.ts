import { NextResponse } from "next/server";
import { authenticateAgentGrant } from "@/lib/agent-auth";
import { db } from "@/lib/db";
import { agentCheckoutRepresentation } from "@/lib/services/agent-checkout";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const grant = await authenticateAgentGrant(request);
  if (!grant) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const checkout = await db.agentCheckout.findFirst({
    where: { id, grantId: grant.id },
    select: { id: true },
  });
  if (!checkout) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ data: await agentCheckoutRepresentation(id) });
}
