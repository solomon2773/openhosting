import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/auth";

// OpenID-style userinfo endpoint for OAuth bearer tokens.
export async function GET(request: NextRequest) {
  const match = (request.headers.get("authorization") ?? "").match(
    /^Bearer (oht_[a-f0-9]+)$/,
  );
  if (!match) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }
  const token = await db.oauthToken.findUnique({
    where: { tokenHash: sha256(match[1]) },
  });
  if (!token || token.expiresAt < new Date()) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }
  const user = await db.user.findUnique({ where: { id: token.userId } });
  if (!user) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }
  return NextResponse.json({
    sub: user.id,
    email: user.email,
    email_verified: Boolean(user.emailVerifiedAt),
    name: `${user.firstName} ${user.lastName}`,
    given_name: user.firstName,
    family_name: user.lastName,
  });
}
