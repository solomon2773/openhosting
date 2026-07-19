// Theme registry. A theme is a brand color scale applied at runtime via
// `data-theme` on <html> — the CSS blocks live in globals.css. Adding a
// theme = one entry here + one CSS block (open/closed; no component edits).

export const THEMES = [
  { slug: "indigo", label: "Indigo (default)", preview: "#4f46e5" },
  { slug: "emerald", label: "Emerald", preview: "#059669" },
  { slug: "rose", label: "Rose", preview: "#e11d48" },
  { slug: "amber", label: "Amber", preview: "#d97706" },
  { slug: "ocean", label: "Ocean", preview: "#0284c7" },
  { slug: "violet", label: "Violet", preview: "#7c3aed" },
] as const;

export type ThemeSlug = (typeof THEMES)[number]["slug"];

export function isTheme(value: string): value is ThemeSlug {
  return THEMES.some((t) => t.slug === value);
}
