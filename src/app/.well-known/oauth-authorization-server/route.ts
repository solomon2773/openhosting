import { NextResponse } from "next/server";
import { authorizationServerMetadata } from "@/lib/oauth-metadata";

export async function GET() {
  return NextResponse.json(await authorizationServerMetadata(), {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
