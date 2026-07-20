import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { REF_COOKIE } from "@/lib/services/affiliates";

// Affiliate referral link: /r/CODE sets the attribution cookie (30 days,
// last-click wins) and counts the visit.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const affiliate = await db.affiliate.findUnique({ where: { code } });
  const response = NextResponse.redirect(new URL("/", request.url));
  if (affiliate) {
    await db.affiliate.update({
      where: { id: affiliate.id },
      data: { visits: { increment: 1 } },
    });
    response.cookies.set(REF_COOKIE, code, {
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return response;
}
