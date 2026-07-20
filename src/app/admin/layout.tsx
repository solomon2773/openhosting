import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { logout } from "@/lib/actions/auth";
import { syncExtensions } from "@/lib/extensions/registry";
import { getT, type MessageKey } from "@/lib/i18n";

const NAV: Array<{ heading: MessageKey; items: { href: string; label: MessageKey }[] }> = [
  {
    heading: "admin.nav.overview",
    items: [{ href: "/admin", label: "admin.nav.dashboard" }],
  },
  {
    heading: "admin.nav.billing",
    items: [
      { href: "/admin/orders", label: "admin.nav.orders" },
      { href: "/admin/invoices", label: "admin.nav.invoices" },
      { href: "/admin/services", label: "admin.nav.services" },
      { href: "/admin/coupons", label: "admin.nav.coupons" },
      { href: "/admin/taxes", label: "admin.nav.taxes" },
      { href: "/admin/currencies", label: "admin.nav.currencies" },
    ],
  },
  {
    heading: "admin.nav.catalog",
    items: [
      { href: "/admin/categories", label: "admin.nav.categories" },
      { href: "/admin/products", label: "admin.nav.products" },
    ],
  },
  {
    heading: "admin.nav.customers",
    items: [
      { href: "/admin/users", label: "admin.nav.users" },
      { href: "/admin/tickets", label: "admin.nav.tickets" },
      { href: "/admin/affiliates", label: "admin.nav.affiliates" },
    ],
  },
  {
    heading: "admin.nav.system",
    items: [
      { href: "/admin/fraud", label: "admin.nav.fraud" },
      { href: "/admin/announcements", label: "admin.nav.announcements" },
      { href: "/admin/extensions", label: "admin.nav.extensions" },
      { href: "/admin/api-keys", label: "admin.nav.apiKeys" },
      { href: "/admin/oauth-clients", label: "admin.nav.oauthClients" },
      { href: "/admin/email-templates", label: "admin.nav.emailTemplates" },
      { href: "/admin/settings", label: "admin.nav.settings" },
      { href: "/admin/audit-log", label: "admin.nav.auditLog" },
    ],
  },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();
  const [companyName, t] = await Promise.all([
    getSetting("company_name"),
    getT(),
  ]);
  // make sure newly shipped drivers appear without a migration step
  await syncExtensions();

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-slate-900 text-slate-300 md:flex">
        <Link href="/admin" className="flex items-center gap-2 px-5 py-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold text-white">
            {companyName.charAt(0)}
          </span>
          <span className="font-semibold text-white">Admin</span>
        </Link>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          {NAV.map((group) => (
            <div key={group.heading}>
              <p className="px-3 pb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                {t(group.heading)}
              </p>
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-lg px-3 py-1.5 text-sm hover:bg-slate-800 hover:text-white"
                >
                  {t(item.label)}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="border-t border-slate-800 p-4 text-sm">
          <p className="truncate font-medium text-white">
            {user.firstName} {user.lastName}
          </p>
          <div className="mt-2 flex items-center justify-between">
            <Link href="/dashboard" className="text-slate-400 hover:text-white">
              {t("admin.nav.clientArea")}
            </Link>
            <form action={logout}>
              <button type="submit" className="text-slate-400 hover:text-white">
                {t("dash.nav.signOut")}
              </button>
            </form>
          </div>
        </div>
      </aside>
      <main className="flex-1 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">{children}</div>
      </main>
    </div>
  );
}
