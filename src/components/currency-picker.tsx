"use client";

import { useTransition } from "react";
import { switchCurrency } from "@/lib/actions/currency";

export function CurrencyPicker({
  currencies,
  active,
}: {
  currencies: string[];
  active: string;
}) {
  const [, startTransition] = useTransition();
  if (currencies.length < 2) return null;
  return (
    <select
      aria-label="Currency"
      className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700"
      defaultValue={active}
      onChange={(e) => {
        const formData = new FormData();
        formData.set("currency", e.target.value);
        startTransition(() => switchCurrency(formData));
      }}
    >
      {currencies.map((code) => (
        <option key={code} value={code}>
          {code}
        </option>
      ))}
    </select>
  );
}
