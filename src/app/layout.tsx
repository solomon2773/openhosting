import type { Metadata } from "next";
import "./globals.css";
import { getSetting } from "@/lib/settings";
import { getLocale } from "@/lib/i18n";
import { isTheme } from "@/lib/themes";

// Every page reads live data (settings, catalog, session), so nothing is
// statically prerendered — this keeps `next build` from needing a database.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "OpenHosting — Billing for hosting providers",
    template: "%s · OpenHosting",
  },
  description:
    "Open-source billing and client management platform for hosting providers.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [theme, locale] = await Promise.all([
    getSetting("theme"),
    getLocale(),
  ]);
  return (
    <html lang={locale} data-theme={isTheme(theme) ? theme : "indigo"}>
      <body>{children}</body>
    </html>
  );
}
