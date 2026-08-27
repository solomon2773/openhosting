import "server-only";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { roundAsset } from "@/lib/billing-policy";
import { getSetting } from "@/lib/settings";

// Currency service: the only module that knows about exchange rates.
// All catalog prices are stored in the base currency (settings.currency);
// orders/invoices/services are locked to the currency chosen at checkout.

const CURRENCY_COOKIE = "oh_currency";

export type ChargeCurrency = {
  code: string;
  rate: number;
  kind: "FIAT" | "STABLECOIN";
  decimals: number;
  settlementNetworks: string[];
};

function networksFromJson(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((network): network is string => typeof network === "string");
}

export async function getBaseCurrency(): Promise<string> {
  return getSetting("currency");
}

export async function getEnabledCurrencies(): Promise<ChargeCurrency[]> {
  const base = await getBaseCurrency();
  const extra = await db.currency.findMany({
    where: { OR: [{ enabled: true }, { code: base }] },
  });
  const baseRecord = extra.find((currency) => currency.code === base);
  return [
    {
      code: base,
      rate: 1,
      kind: baseRecord?.kind ?? "FIAT",
      decimals: baseRecord?.decimals ?? 2,
      settlementNetworks: networksFromJson(baseRecord?.settlementNetworks),
    },
    ...extra
      .filter((c) => c.code !== base)
      .map((c) => ({
        code: c.code,
        rate: Number(c.rate),
        kind: c.kind,
        decimals: c.decimals,
        settlementNetworks: networksFromJson(c.settlementNetworks),
      })),
  ];
}

// The customer's active currency: cookie if valid, else their profile
// preference, else base.
export async function getActiveCurrency(
  userPreference?: string | null,
): Promise<ChargeCurrency> {
  const currencies = await getEnabledCurrencies();
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(CURRENCY_COOKIE)?.value;
  return (
    currencies.find((c) => c.code === fromCookie) ??
    currencies.find((c) => c.code === userPreference) ??
    currencies[0]
  );
}

export async function getChargeCurrency(code: string): Promise<ChargeCurrency | null> {
  const normalized = code.toUpperCase();
  const base = await getBaseCurrency();
  const record = await db.currency.findUnique({ where: { code: normalized } });
  if (normalized === base) {
    return {
      code: base,
      rate: 1,
      kind: record?.kind ?? "FIAT",
      decimals: record?.decimals ?? 2,
      settlementNetworks: networksFromJson(record?.settlementNetworks),
    };
  }
  if (!record) return null;
  return {
    code: record.code,
    rate: Number(record.rate),
    kind: record.kind,
    decimals: record.decimals,
    settlementNetworks: networksFromJson(record.settlementNetworks),
  };
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
  currency: Pick<ChargeCurrency, "code" | "rate" | "decimals">,
): number {
  return roundAsset(amount * currency.rate, currency.decimals);
}

// Convert an amount in `code` back to the base currency at current rates.
export async function convertToBase(
  amount: number,
  code: string,
): Promise<number> {
  const currencies = await getEnabledCurrencies();
  const currency = currencies.find((c) => c.code === code);
  if (!currency || currency.rate === 0) return amount;
  return roundAsset(amount / currency.rate, currencies[0].decimals);
}
