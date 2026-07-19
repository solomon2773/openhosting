"use client";

import { useTransition } from "react";
import { switchLocale } from "@/lib/actions/locale";

export function LocalePicker({
  locales,
  active,
}: {
  locales: { code: string; label: string }[];
  active: string;
}) {
  const [, startTransition] = useTransition();
  return (
    <select
      aria-label="Language"
      className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700"
      defaultValue={active}
      onChange={(e) => {
        const formData = new FormData();
        formData.set("locale", e.target.value);
        startTransition(() => switchLocale(formData));
      }}
    >
      {locales.map((locale) => (
        <option key={locale.code} value={locale.code}>
          {locale.label}
        </option>
      ))}
    </select>
  );
}
