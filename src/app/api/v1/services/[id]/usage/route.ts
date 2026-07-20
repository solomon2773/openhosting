import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiKey } from "@/lib/api-auth";
import { recordUsage } from "@/lib/services/usage";

const schema = z.object({
  quantity: z.number().positive(),
  description: z.string().optional(),
});

// Push a metered usage record for a service.
export const POST = withApiKey("usage:write", async (request, { params }) => {
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: body.error.issues },
      { status: 422 },
    );
  }
  const result = await recordUsage(
    params.id,
    body.data.quantity,
    body.data.description,
  );
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ data: { recorded: true } }, { status: 201 });
});
