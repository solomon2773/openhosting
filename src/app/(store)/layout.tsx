import Link from "next/link";
import { getUser } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { db } from "@/lib/db";
import { readCart } from "@/lib/cart";
import {
  getActiveCurrency,
  getEnabledCurrencies,
} from "@/lib/services/currency";
import { CurrencyPicker } from "@/components/currency-picker";
import { getLocale, getT, LOCALES } from "@/lib/i18n";
import { LocalePicker } from "@/components/locale-picker";

export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, companyName, categories, cart] = await Promise.all([
    getUser(),
    getSetting("company_name"),
    db.category.findMany({
      where: { hidden: false },
      orderBy: { sortOrder: "asc" },
    }),
    readCart(),
  ]);
  const [currencies, activeCurrency, locale, t] = await Promise.all([
    getEnabledCurrencies(),
    getActiveCurrency(user?.currency),
    getLocale(),
    getT(),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              {companyName.charAt(0)}
            </span>
            <span className="font-semibold">{companyName}</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-slate-600 md:flex">
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/store/${c.slug}`}
                className="hover:text-slate-900"
              >
                {c.name}
              </Link>
            ))}
            <Link href="/blog" className="hover:text-slate-900">
              {t("nav.blog")}
            </Link>
            <Link href="/kb" className="hover:text-slate-900">
              Knowledgebase
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <LocalePicker locales={LOCALES} active={locale} />
            <CurrencyPicker
              currencies={currencies.map((c) => c.code)}
              active={activeCurrency.code}
            />
            <Link
              href="/cart"
              className="btn-secondary relative"
              aria-label="Cart"
            >
              {t("nav.cart")}
              {cart.length > 0 && (
                <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
                  {cart.length}
                </span>
              )}
            </Link>
            {user ? (
              <Link href="/dashboard" className="btn-primary">
                {t("nav.dashboard")}
              </Link>
            ) : (
              <Link href="/login" className="btn-primary">
                {t("nav.signIn")}
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-slate-500 md:flex-row">
          <p>
            © {new Date().getFullYear()} {companyName}.{" "}
            {t("footer.allRights")}
          </p>
          <p>
            {t("footer.poweredBy")}{" "}
            <a
              href="https://github.com/solomon2773/openhosting"
              className="text-brand-600 hover:underline"
            >
              OpenHosting
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
