"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, requireUser, sha256 } from "@/lib/auth";
import { audit } from "@/lib/audit";
import type { FormState } from "@/lib/actions/auth";

// ── Consent (end-user) ──────────────────────────────────────────────────────

export async function approveAuthorization(formData: FormData): Promise<void> {
  const user = await requireUser();
  const clientId = String(formData.get("client_id") ?? "");
  const redirectUri = String(formData.get("redirect_uri") ?? "");
  const state = String(formData.get("state") ?? "");

  const client = await db.oauthClient.findUnique({ where: { clientId } });
  if (!client || !client.redirectUris.split("\n").includes(redirectUri)) {
    redirect("/dashboard");
  }

  const raw = randomBytes(32).toString("hex");
  await db.oauthCode.create({
    data: {
      codeHash: sha256(raw),
      clientId: client.id,
      userId: user.id,
      redirectUri,
      expiresAt: new Date(Date.now() + 10 * 60_000),
    },
  });
  await audit("oauth.authorized", { userId: user.id, targetId: client.id });
  const url = new URL(redirectUri);
  url.searchParams.set("code", raw);
  if (state) url.searchParams.set("state", state);
  redirect(url.toString());
}

// ── Admin client management ─────────────────────────────────────────────────

export async function createOauthClient(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin("oauth");
  const name = String(formData.get("name") ?? "").trim();
  const redirectUris = String(formData.get("redirectUris") ?? "")
    .split("\n")
    .map((u) => u.trim())
    .filter(Boolean)
    .join("\n");
  if (!name || !redirectUris) {
    return { error: "Name and at least one redirect URI are required." };
  }
  const clientId = `ohc_${randomBytes(12).toString("hex")}`;
  const secret = `ohs_${randomBytes(24).toString("hex")}`;
  await db.oauthClient.create({
    data: { name, clientId, clientSecret: sha256(secret), redirectUris },
  });
  await audit("admin.oauth_client_created", { userId: admin.id });
  revalidatePath("/admin/oauth-clients");
  return {
    success: `Client created. ID: ${clientId} — secret (copy now, shown once): ${secret}`,
  };
}

export async function deleteOauthClient(formData: FormData): Promise<void> {
  const admin = await requireAdmin("oauth");
  await db.oauthClient.delete({
    where: { id: String(formData.get("id") ?? "") },
  });
  await audit("admin.oauth_client_deleted", { userId: admin.id });
  revalidatePath("/admin/oauth-clients");
}
