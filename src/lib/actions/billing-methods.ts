"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { startPaymentMethodSetup } from "@/lib/services/payments";
import { audit } from "@/lib/audit";

export async function beginCardSetup(formData: FormData): Promise<void> {
  const user = await requireUser();
  const gateway = String(formData.get("gateway") ?? "");
  const url = await startPaymentMethodSetup(user.id, gateway);
  redirect(url);
}

export async function removeStoredMethod(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  await db.storedPaymentMethod.deleteMany({
    where: { id, userId: user.id },
  });
  await audit("user.payment_method_removed", { userId: user.id });
  revalidatePath("/dashboard/account/billing");
}

export async function makeMethodDefault(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const method = await db.storedPaymentMethod.findUnique({ where: { id } });
  if (!method || method.userId !== user.id) return;
  await db.storedPaymentMethod.updateMany({
    where: { userId: user.id },
    data: { isDefault: false },
  });
  await db.storedPaymentMethod.update({
    where: { id },
    data: { isDefault: true },
  });
  revalidatePath("/dashboard/account/billing");
}
