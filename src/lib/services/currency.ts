import "server-only";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";

// Currency service: the only module that knows about exchange rates.
// All catalog prices are stored in the base currency (settings.currency);
// orders/invoices/services are locked to the currency chosen at checkout.

const CURRENCY_COOKIE = "oh_currency";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function getBaseCurrency(): Promise<string> {
  return getSetting("currency");
}

export async function getEnabledCurrencies(): Promise<
  Array<{ code: string; rate: number }>
> {
  const base = await getBaseCurrency();
  const extra = await db.currency.findMany({ where: { enabled: true } });
  return [
    { code: base, rate: 1 },
    ...extra
      .filter((c) => c.code !== base)
      .map((c) => ({ code: c.code, rate: Number(c.rate) })),
  ];
}

// The customer's active currency: cookie if valid, else their profile
// preference, else base.
export async function getActiveCurrency(
  userPreference?: string | null,
): Promise<{ code: string; rate: number }> {
  const currencies = await getEnabledCurrencies();
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(CURRENCY_COOKIE)?.value;
  return (
    currencies.find((c) => c.code === fromCookie) ??
    currencies.find((c) => c.code === userPreference) ??
    currencies[0]
  );
}

export async function setActiveCurrencyCookie(code: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(CURRENCY_COOKIE, code, {
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export function convertFromBase(
  amount: number,
  currency: { code: string; rate: number },
): number {
  return round2(amount * currency.rate);
}

// Convert an amount in `code` back to the base currency at current rates.
export async function convertToBase(
  amount: number,
  code: string,
): Promise<number> {
  const currencies = await getEnabledCurrencies();
  const currency = currencies.find((c) => c.code === code);
  if (!currency || currency.rate === 0) return amount;
  return round2(amount / currency.rate);
}
