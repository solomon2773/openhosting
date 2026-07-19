import "server-only";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/auth";
import type { ApiKey, User } from "@/generated/prisma/client";

// Authenticates /api/v1 requests via `Authorization: Bearer oh_<key>`.
export async function authenticateApiKey(
  request: Request,
): Promise<(ApiKey & { user: User }) | null> {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer (oh_[A-Za-z0-9]+)$/);
  if (!match) return null;
  const key = await db.apiKey.findUnique({
    where: { keyHash: sha256(match[1]) },
    include: { user: true },
  });
  if (!key) return null;
  await db.apiKey.update({
    where: { id: key.id },
    data: { lastUsedAt: new Date() },
  });
  return key;
}

export function apiKeyHasPermission(key: ApiKey, permission: string): boolean {
  const perms = key.permissions as string[];
  return perms.includes("*") || perms.includes(permission);
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function notFoundJson() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

// Wraps an /api/v1 handler with API-key auth + permission check.
export function withApiKey(
  permission: string,
  handler: (
    request: Request,
    context: { key: ApiKey & { user: User }; params: Record<string, string> },
  ) => Promise<Response>,
) {
  return async (
    request: Request,
    routeContext: { params: Promise<Record<string, string>> },
  ): Promise<Response> => {
    const key = await authenticateApiKey(request);
    if (!key || !apiKeyHasPermission(key, permission)) return unauthorized();
    const params = await routeContext.params;
    return handler(request, { key, params });
  };
}
