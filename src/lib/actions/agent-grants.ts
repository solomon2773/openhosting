"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireUser, sha256 } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getEnabledCurrencies } from "@/lib/services/currency";
import type { FormState } from "@/lib/actions/auth";

const GRANTS_PATH = "/dashboard/account/agent-access";

export async function createAgentGrant(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const productIds = [...new Set(formData.getAll("productId").map(String))];
  const allowedCurrencies = [
    ...new Set(formData.getAll("currency").map((code) => String(code).toUpperCase())),
  ];
  const maxPerOrderBase = Number(formData.get("maxPerOrderBase") ?? 0);
  const spendLimitBase = Number(formData.get("spendLimitBase") ?? 0);
  const expiresInDays = Number(formData.get("expiresInDays") ?? 30);

  if (!name) return { error: "Give the purchasing grant a name." };
  if (productIds.length === 0) return { error: "Select at least one product." };
  if (allowedCurrencies.length === 0) {
    return { error: "Select at least one currency." };
  }
  if (
    !Number.isFinite(maxPerOrderBase) ||
    maxPerOrderBase <= 0 ||
    !Number.isFinite(spendLimitBase) ||
    spendLimitBase < maxPerOrderBase
  ) {
    return { error: "The total limit must be at least the per-order limit." };
  }
  if (!Number.isInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > 90) {
    return { error: "Expiry must be between 1 and 90 days." };
  }

  const [productCount, currencies] = await Promise.all([
    db.product.count({ where: { id: { in: productIds }, hidden: false } }),
    getEnabledCurrencies(),
  ]);
  if (productCount !== productIds.length) {
    return { error: "One or more selected products are unavailable." };
  }
  const currencySet = new Set(currencies.map((currency) => currency.code));
  if (allowedCurrencies.some((code) => !currencySet.has(code))) {
    return { error: "One or more selected currencies are unavailable." };
  }

  const raw = `ag_${randomBytes(32).toString("hex")}`;
  const grant = await db.agentGrant.create({
    data: {
      name,
      tokenHash: sha256(raw),
      prefix: raw.slice(0, 13),
      userId: user.id,
      allowedProductIds: productIds,
      allowedCurrencies,
      maxPerOrderBase,
      spendLimitBase,
      expiresAt: new Date(Date.now() + expiresInDays * 86_400_000),
    },
  });
  await audit("agent.grant_created", {
    userId: user.id,
    targetType: "agent_grant",
    targetId: grant.id,
    metadata: { productIds, allowedCurrencies },
  });
  revalidatePath(GRANTS_PATH);
  return {
    success: `Grant created — copy this token now; it will not be shown again: ${raw}`,
  };
}

export async function revokeAgentGrant(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const result = await db.agentGrant.updateMany({
    where: { id, userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (result.count) {
    await audit("agent.grant_revoked", {
      userId: user.id,
      targetType: "agent_grant",
      targetId: id,
    });
  }
  revalidatePath(GRANTS_PATH);
}
