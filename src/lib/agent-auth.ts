import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/auth";

export type AgentPrincipal = Prisma.AgentGrantGetPayload<{
  include: { user: true };
}>;

export async function authenticateAgentGrant(
  request: Request,
  now = new Date(),
): Promise<AgentPrincipal | null> {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer (ag_[A-Za-z0-9]+)$/);
  if (!match) return null;

  const grant = await db.agentGrant.findUnique({
    where: { tokenHash: sha256(match[1]) },
    include: { user: true },
  });
  if (!grant || grant.revokedAt || (grant.expiresAt && grant.expiresAt <= now)) {
    return null;
  }
  await db.agentGrant.update({
    where: { id: grant.id },
    data: { lastUsedAt: now },
  });
  return grant;
}
