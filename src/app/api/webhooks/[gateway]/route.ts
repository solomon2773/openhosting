import { NextRequest, NextResponse } from "next/server";
import { handleGatewayWebhook } from "@/lib/services/payments";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gateway: string }> },
) {
  const { gateway } = await params;
  try {
    const handled = await handleGatewayWebhook(request, gateway);
    return NextResponse.json({ received: true, handled });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Webhook error" },
      { status: 400 },
    );
  }
}
