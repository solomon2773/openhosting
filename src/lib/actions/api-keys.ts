"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, sha256 } from "@/lib/auth";
import { audit } from "@/lib/audit";
import type { FormState } from "@/lib/actions/auth";

// Creates an API key; the raw key is returned once via FormState.success.
export async function createApiKey(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin("api-keys");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give the key a name." };
  const permissions = formData.getAll("permission").map(String);

  const raw = `oh_${randomBytes(24).toString("hex")}`;
  await db.apiKey.create({
    data: {
      name,
      keyHash: sha256(raw),
      prefix: raw.slice(0, 11),
      userId: admin.id,
      permissions: permissions.length ? permissions : ["*"],
    },
  });
  await audit("admin.api_key_created", { userId: admin.id });
  revalidatePath("/admin/api-keys");
  return {
    success: `Key created — copy it now, it won't be shown again: ${raw}`,
  };
}

export async function revokeApiKey(formData: FormData): Promise<void> {
  const admin = await requireAdmin("api-keys");
  await db.apiKey.delete({
    where: { id: String(formData.get("id") ?? "") },
  });
  await audit("admin.api_key_revoked", { userId: admin.id });
  revalidatePath("/admin/api-keys");
}
