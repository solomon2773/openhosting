# Themes

OpenHosting ships six built-in themes, switchable at runtime under
**Admin → Settings → Theme** (no rebuild or redeploy):

| Theme | Accent |
|---|---|
| Indigo (default) | `#4f46e5` |
| Emerald | `#059669` |
| Rose | `#e11d48` |
| Amber | `#d97706` |
| Ocean | `#0284c7` |
| Violet | `#7c3aed` |

## How it works

Every component uses the `brand-*` Tailwind scale, which resolves to CSS
custom properties. The selected theme is applied as `data-theme` on
`<html>`, and each theme is a block in
[`src/app/globals.css`](../src/app/globals.css) that overrides the
`--color-brand-*` variables — so switching themes restyles the whole app
instantly.

## Adding a theme

1. Add a `[data-theme="yourtheme"] { --color-brand-50: …; … }` block to
   `globals.css` with a full 50–900 color scale (any Tailwind palette works).
2. Register it in [`src/lib/themes.ts`](../src/lib/themes.ts):
   `{ slug: "yourtheme", label: "Your theme", preview: "#hex" }`.

That's it — it appears in the settings dropdown. No component changes are
ever needed (the theme system is open/closed by design).
