import type { Metadata } from "next";
import "./globals.css";

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
