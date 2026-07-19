import type { Metadata } from "next";
import "./globals.css";

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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
