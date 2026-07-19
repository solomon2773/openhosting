"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { BillingCycle } from "@prisma/client";
import { getUser } from "@/lib/auth";
import { clearCart, readCart, readCoupon, writeCart, writeCoupon } from "@/lib/cart";
import { placeOrder, priceCart, validateCoupon } from "@/lib/services/orders";
import { markInvoicePaid } from "@/lib/billing";
import { audit } from "@/lib/audit";
import type { FormState } from "@/lib/actions/auth";

export async function addToCart(formData: FormData): Promise<void> {
  const productId = String(formData.get("productId") ?? "");
  const cycle = String(formData.get("cycle") ?? "MONTHLY") as BillingCycle;
  const quantity = Math.max(1, Number(formData.get("quantity") ?? 1));
  const optionValues = formData
    .getAll("optionValue")
    .map(String)
    .filter(Boolean);

  const cart = await readCart();
  cart.push({ productId, cycle, quantity, optionValues });
  await writeCart(cart);
  redirect("/cart");
}

export async function removeFromCart(formData: FormData): Promise<void> {
  const index = Number(formData.get("index"));
  const cart = await readCart();
  cart.splice(index, 1);
  await writeCart(cart);
  revalidatePath("/cart");
}

export async function applyCoupon(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const code = String(formData.get("code") ?? "").trim();
  if (!code) {
    await writeCoupon(null);
    return { success: "Coupon removed." };
  }
  const coupon = await validateCoupon(code);
  if (!coupon) return { error: "That coupon code is not valid." };
  await writeCoupon(code);
  revalidatePath("/cart");
  return { success: `Coupon ${coupon.code} applied.` };
}

export async function checkout(): Promise<void> {
  const user = await getUser();
  if (!user) redirect("/login");

  const cart = await readCart();
  const lines = await priceCart(cart);
  if (lines.length === 0) redirect("/cart");

  const coupon = await readCoupon();
  const { order, invoice } = await placeOrder(user.id, lines, coupon);
  await audit("order.placed", {
    userId: user.id,
    targetType: "order",
    targetId: order.id,
  });
  await clearCart();

  // Zero-total orders (free products / 100% coupons) activate immediately.
  if (Number(invoice.total) === 0) {
    await markInvoicePaid(invoice.id, "free");
  }
  redirect(`/dashboard/invoices/${invoice.id}`);
}
