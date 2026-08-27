import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { OauthClient } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/auth";
import { verifyPkceS256 } from "@/lib/oauth-policy";

const ACCESS_TOKEN_TTL_S = 60 * 60;
const REFRESH_TOKEN_TTL_S = 30 * 24 * 60 * 60;

function oauthError(
  error: string,
  status = 400,
  description?: string,
): NextResponse {
  return NextResponse.json(
    { error, ...(description ? { error_description: description } : {}) },
    {
      status,
      headers: { "Cache-Control": "no-store", Pragma: "no-cache" },
    },
  );
}

function basicCredentials(request: Request): {
  clientId: string;
  clientSecret: string;
} | null {
  const match = (request.headers.get("authorization") ?? "").match(
    /^Basic ([A-Za-z0-9+/=]+)$/,
  );
  if (!match) return null;
  try {
    const decoded = Buffer.from(match[1], "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 0) return null;
    return {
      clientId: decodeURIComponent(decoded.slice(0, separator)),
      clientSecret: decodeURIComponent(decoded.slice(separator + 1)),
    };
  } catch {
    return null;
  }
}

async function authenticateClient(
  request: Request,
  form: FormData,
): Promise<OauthClient | null> {
  const basic = basicCredentials(request);
  const clientId = basic?.clientId ?? String(form.get("client_id") ?? "");
  const client = await db.oauthClient.findUnique({ where: { clientId } });
  if (!client) return null;
  if (client.publicClient) return basic ? null : client;

  const suppliedSecret =
    basic?.clientSecret ?? String(form.get("client_secret") ?? "");
  return client.clientSecret && client.clientSecret === sha256(suppliedSecret)
    ? client
    : null;
}

function tokenPayload(input: {
  accessToken: string;
  refreshToken: string;
  scopes: string[];
}) {
  return {
    access_token: input.accessToken,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL_S,
    refresh_token: input.refreshToken,
    scope: input.scopes.join(" "),
  };
}

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  if (!form) return oauthError("invalid_request");
  const client = await authenticateClient(request, form);
  if (!client) return oauthError("invalid_client", 401);

  const grantType = String(form.get("grant_type") ?? "");
  if (grantType === "authorization_code") {
    const code = await db.oauthCode.findUnique({
      where: { codeHash: sha256(String(form.get("code") ?? "")) },
    });
    const resource = String(form.get("resource") ?? "") || null;
    if (
      !code ||
      code.clientId !== client.id ||
      code.expiresAt <= new Date() ||
      code.redirectUri !== String(form.get("redirect_uri") ?? "") ||
      code.resource !== resource ||
      !verifyPkceS256(
        String(form.get("code_verifier") ?? ""),
        code.codeChallenge,
      )
    ) {
      return oauthError("invalid_grant");
    }

    const accessToken = `oht_${randomBytes(32).toString("hex")}`;
    const refreshToken = `ohr_${randomBytes(32).toString("hex")}`;
    const now = new Date();
    const scopes = code.scopes as string[];
    await db.$transaction(async (tx) => {
      await tx.oauthToken.create({
        data: {
          tokenHash: sha256(accessToken),
          refreshTokenHash: sha256(refreshToken),
          clientId: client.id,
          userId: code.userId,
          scopes,
          resource: code.resource,
          expiresAt: new Date(now.getTime() + ACCESS_TOKEN_TTL_S * 1_000),
          refreshExpiresAt: new Date(
            now.getTime() + REFRESH_TOKEN_TTL_S * 1_000,
          ),
        },
      });
      await tx.oauthCode.delete({ where: { id: code.id } });
    });
    return NextResponse.json(
      tokenPayload({ accessToken, refreshToken, scopes }),
      { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } },
    );
  }

  if (grantType === "refresh_token") {
    const rawRefreshToken = String(form.get("refresh_token") ?? "");
    const token = await db.oauthToken.findUnique({
      where: { refreshTokenHash: sha256(rawRefreshToken) },
    });
    const resource = String(form.get("resource") ?? "") || null;
    if (
      !token ||
      token.clientId !== client.id ||
      token.revokedAt ||
      !token.refreshExpiresAt ||
      token.refreshExpiresAt <= new Date() ||
      token.resource !== resource
    ) {
      return oauthError("invalid_grant");
    }

    const accessToken = `oht_${randomBytes(32).toString("hex")}`;
    const refreshToken = `ohr_${randomBytes(32).toString("hex")}`;
    const scopes = token.scopes as string[];
    await db.oauthToken.update({
      where: { id: token.id },
      data: {
        tokenHash: sha256(accessToken),
        refreshTokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_S * 1_000),
      },
    });
    return NextResponse.json(
      tokenPayload({ accessToken, refreshToken, scopes }),
      { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } },
    );
  }

  return oauthError("unsupported_grant_type");
}
