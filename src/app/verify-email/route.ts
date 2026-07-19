import { NextRequest, NextResponse } from "next/server";
import { consumeToken } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const userId = await consumeToken(token, "EMAIL_VERIFICATION");
  if (userId) {
    await db.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    });
  }
  return NextResponse.redirect(new URL("/dashboard", request.url));
}
