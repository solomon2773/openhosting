"use server";

import { revalidatePath } from "next/cache";
import { setLocaleCookie } from "@/lib/i18n";

export async function switchLocale(formData: FormData): Promise<void> {
  await setLocaleCookie(String(formData.get("locale") ?? ""));
  revalidatePath("/", "layout");
}
