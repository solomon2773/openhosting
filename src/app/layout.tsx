import type { Metadata } from "next";
import "./globals.css";
import { getSetting } from "@/lib/settings";
import { getLocale } from "@/lib/i18n";
import { isTheme } from "@/lib/themes";
import { ColorModeToggle } from "@/components/color-mode-toggle";

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
    <html
      lang={locale}
      data-theme={isTheme(theme) ? theme : "indigo"}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=localStorage.getItem("openhosting-color-mode");if(p!=="light"&&p!=="dark")p="system";var m=p==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):p;document.documentElement.dataset.colorMode=m;document.documentElement.dataset.colorModePreference=p;document.documentElement.style.colorScheme=m}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        {children}
        <ColorModeToggle />
      </body>
    </html>
  );
}
