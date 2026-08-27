"use server";

import { revalidatePath } from "next/cache";
import { setActiveCurrencyCookie } from "@/lib/services/currency";

export async function switchCurrency(formData: FormData): Promise<void> {
  const code = String(formData.get("currency") ?? "");
  if (/^[A-Z0-9]{3,12}$/.test(code)) await setActiveCurrencyCookie(code);
  revalidatePath("/", "layout");
}
