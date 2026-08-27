import { NextRequest, NextResponse } from "next/server";
import { authenticateOauthToken } from "@/lib/oauth";

// OpenID-style userinfo endpoint for OAuth bearer tokens.
export async function GET(request: NextRequest) {
  const authenticated = await authenticateOauthToken(request);
  if (!authenticated || !authenticated.scopes.includes("openid")) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }
  const { user } = authenticated;
  return NextResponse.json({
    sub: user.id,
    email: user.email,
    email_verified: Boolean(user.emailVerifiedAt),
    name: `${user.firstName} ${user.lastName}`,
    given_name: user.firstName,
    family_name: user.lastName,
  });
}
