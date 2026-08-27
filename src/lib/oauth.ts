import "server-only";

import type { OauthClient, OauthToken, User } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/auth";

export type AuthenticatedOauthToken = {
  rawToken: string;
  token: OauthToken;
  client: OauthClient;
  user: User;
  scopes: string[];
};

export function bearerToken(request: Request): string | null {
  const match = (request.headers.get("authorization") ?? "").match(
    /^Bearer (oht_[A-Za-z0-9]+)$/,
  );
  return match?.[1] ?? null;
}

export async function authenticateOauthToken(
  request: Request,
  expectedResource?: string,
): Promise<AuthenticatedOauthToken | null> {
  const rawToken = bearerToken(request);
  if (!rawToken) return null;
  const token = await db.oauthToken.findUnique({
    where: { tokenHash: sha256(rawToken) },
    include: { client: true },
  });
  if (
    !token ||
    token.revokedAt ||
    token.expiresAt <= new Date() ||
    (expectedResource !== undefined && token.resource !== expectedResource)
  ) {
    return null;
  }
  const user = await db.user.findUnique({ where: { id: token.userId } });
  if (!user) return null;
  return {
    rawToken,
    token,
    client: token.client,
    user,
    scopes: token.scopes as string[],
  };
}

export function oauthBearerChallenge(
  resourceMetadataUrl: string,
  scopes: readonly string[],
): string {
  return `Bearer resource_metadata="${resourceMetadataUrl}", scope="${scopes.join(" ")}"`;
}
