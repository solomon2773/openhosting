import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/auth";

const TOKEN_TTL_S = 30 * 24 * 3600; // 30 days

// OAuth2 token endpoint: exchanges an authorization code for a bearer token.
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const grantType = String(form.get("grant_type") ?? "");
  if (grantType !== "authorization_code") {
    return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400 });
  }

  const client = await db.oauthClient.findUnique({
    where: { clientId: String(form.get("client_id") ?? "") },
  });
  if (
    !client ||
    client.clientSecret !== sha256(String(form.get("client_secret") ?? ""))
  ) {
    return NextResponse.json({ error: "invalid_client" }, { status: 401 });
  }

  const code = await db.oauthCode.findUnique({
    where: { codeHash: sha256(String(form.get("code") ?? "")) },
  });
  if (
    !code ||
    code.clientId !== client.id ||
    code.expiresAt < new Date() ||
    code.redirectUri !== String(form.get("redirect_uri") ?? "")
  ) {
    return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
  }
  await db.oauthCode.delete({ where: { id: code.id } });

  const raw = `oht_${randomBytes(32).toString("hex")}`;
  await db.oauthToken.create({
    data: {
      tokenHash: sha256(raw),
      clientId: client.id,
      userId: code.userId,
      expiresAt: new Date(Date.now() + TOKEN_TTL_S * 1000),
    },
  });
  return NextResponse.json({
    access_token: raw,
    token_type: "Bearer",
    expires_in: TOKEN_TTL_S,
  });
}
