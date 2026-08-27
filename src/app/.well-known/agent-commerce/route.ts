import { NextResponse } from "next/server";
import { publicUrl } from "@/lib/settings";

export async function GET() {
  const baseUrl = await publicUrl();
  return NextResponse.json({
    version: "2026-08-27",
    catalog: `${baseUrl}/api/agent/catalog`,
    native_checkout: `${baseUrl}/api/agent/checkout`,
    agentic_commerce_protocol: {
      version: "2026-04-17",
      checkout_sessions: `${baseUrl}/api/acp/checkout_sessions`,
    },
    x402: { version: 2 },
  });
}
