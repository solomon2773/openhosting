import "server-only";
import { cookies } from "next/headers";
import type { CartLine } from "@/lib/services/orders";

const CART_COOKIE = "oh_cart";
const COUPON_COOKIE = "oh_coupon";

export async function readCart(): Promise<CartLine[]> {
  const store = await cookies();
  try {
    const raw = store.get(CART_COOKIE)?.value;
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartLine[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function writeCart(lines: CartLine[]): Promise<void> {
  const store = await cookies();
  store.set(CART_COOKIE, JSON.stringify(lines), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearCart(): Promise<void> {
  const store = await cookies();
  store.delete(CART_COOKIE);
  store.delete(COUPON_COOKIE);
}

export async function readCoupon(): Promise<string | null> {
  const store = await cookies();
  return store.get(COUPON_COOKIE)?.value ?? null;
}

export async function writeCoupon(code: string | null): Promise<void> {
  const store = await cookies();
  if (code) {
    store.set(COUPON_COOKIE, code, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
  } else {
    store.delete(COUPON_COOKIE);
  }
}
