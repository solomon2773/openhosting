import { NextResponse } from "next/server";
import { protectedResourceMetadata } from "@/lib/oauth-metadata";

export async function GET() {
  return NextResponse.json(await protectedResourceMetadata(), {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
