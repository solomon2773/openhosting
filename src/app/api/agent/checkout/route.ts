import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateAgentGrant } from "@/lib/agent-auth";
import {
  AgentCheckoutError,
  agentCheckoutRepresentation,
  createNativeAgentCheckout,
} from "@/lib/services/agent-checkout";

const cycle = z.enum([
  "ONE_TIME",
  "MONTHLY",
  "QUARTERLY",
  "SEMI_ANNUALLY",
  "ANNUALLY",
  "BIENNIALLY",
]);

const requestSchema = z.object({
  currency: z.string().regex(/^[A-Za-z0-9]{3,12}$/),
  coupon_code: z.string().max(100).optional(),
  lines: z
    .array(
      z.object({
        product_id: z.string().min(1),
        cycle,
        quantity: z.number().int().min(1).max(100).default(1),
        option_value_ids: z.array(z.string()).max(50).default([]),
        resale_data: z.record(z.string(), z.string().max(10_000)).optional(),
      }),
    )
    .min(1)
    .max(50),
});

function errorResponse(error: unknown) {
  if (error instanceof AgentCheckoutError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  return NextResponse.json(
    { error: { code: "checkout_failed", message: "Checkout could not be completed." } },
    { status: 500 },
  );
}

export async function POST(request: Request) {
  const grant = await authenticateAgentGrant(request);
  if (!grant) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Invalid purchasing grant." } },
      { status: 401 },
    );
  }
  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length > 200) {
    return NextResponse.json(
      { error: { code: "idempotency_key_required", message: "A valid Idempotency-Key header is required." } },
      { status: 400 },
    );
  }
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "invalid_request", message: "Invalid checkout request.", issues: parsed.error.issues } },
      { status: 422 },
    );
  }
  try {
    const checkout = await createNativeAgentCheckout({
      grant,
      idempotencyKey,
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      request: {
        currency: parsed.data.currency,
        couponCode: parsed.data.coupon_code ?? null,
        lines: parsed.data.lines.map((line) => ({
          productId: line.product_id,
          cycle: line.cycle,
          quantity: line.quantity,
          optionValues: line.option_value_ids,
          resaleData: line.resale_data,
        })),
      },
    });
    return NextResponse.json(
      { data: await agentCheckoutRepresentation(checkout.id) },
      { status: checkout.createdAt.getTime() === checkout.updatedAt.getTime() ? 201 : 200 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
