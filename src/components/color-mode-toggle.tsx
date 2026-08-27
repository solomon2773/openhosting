"use client";

import { useEffect, useState } from "react";
import {
  COLOR_MODE_STORAGE_KEY,
  isColorModePreference,
  resolveColorMode,
  type ColorModePreference,
} from "@/lib/color-mode";

const LABELS: Record<ColorModePreference, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

function applyPreference(preference: ColorModePreference): void {
  const systemPrefersDark = window.matchMedia(
    "(prefers-color-scheme: dark)",
  ).matches;
  const resolved = resolveColorMode(preference, systemPrefersDark);
  document.documentElement.dataset.colorMode = resolved;
  document.documentElement.dataset.colorModePreference = preference;
  document.documentElement.style.colorScheme = resolved;
}

export function ColorModeToggle() {
  const [preference, setPreference] =
    useState<ColorModePreference>("system");

  useEffect(() => {
    const saved = window.localStorage.getItem(COLOR_MODE_STORAGE_KEY);
    const initial = isColorModePreference(saved) ? saved : "system";
    setPreference(initial);
    applyPreference(initial);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if (
        document.documentElement.dataset.colorModePreference === "system"
      ) {
        applyPreference("system");
      }
    };
    media.addEventListener("change", onSystemChange);
    return () => media.removeEventListener("change", onSystemChange);
  }, []);

  function updatePreference(next: ColorModePreference): void {
    setPreference(next);
    window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, next);
    applyPreference(next);
  }

  return (
    <label className="color-mode-toggle border-subtle bg-surface text-muted fixed right-4 bottom-4 z-50 flex items-center gap-2 rounded-full border px-3 py-2 text-xs shadow-lg">
      <span aria-hidden="true">◐</span>
      <span className="sr-only">Color mode</span>
      <select
        aria-label="Color mode"
        className="text-foreground cursor-pointer bg-transparent font-medium outline-none"
        value={preference}
        onChange={(event) =>
          updatePreference(event.target.value as ColorModePreference)
        }
      >
        {Object.entries(LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
