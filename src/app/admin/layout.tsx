import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { logout } from "@/lib/actions/auth";
import { syncExtensions } from "@/lib/extensions/registry";

const NAV: Array<{ heading: string; items: { href: string; label: string }[] }> = [
  {
    heading: "Overview",
    items: [{ href: "/admin", label: "Dashboard" }],
  },
  {
    heading: "Billing",
    items: [
      { href: "/admin/orders", label: "Orders" },
      { href: "/admin/invoices", label: "Invoices" },
      { href: "/admin/services", label: "Services" },
      { href: "/admin/coupons", label: "Coupons" },
      { href: "/admin/taxes", label: "Tax rates" },
      { href: "/admin/currencies", label: "Currencies" },
    ],
  },
  {
    heading: "Catalog",
    items: [
      { href: "/admin/categories", label: "Categories" },
      { href: "/admin/products", label: "Products" },
    ],
  },
  {
    heading: "Customers",
    items: [
      { href: "/admin/users", label: "Users" },
      { href: "/admin/tickets", label: "Tickets" },
    ],
  },
  {
    heading: "System",
    items: [
      { href: "/admin/announcements", label: "Announcements" },
      { href: "/admin/extensions", label: "Extensions" },
      { href: "/admin/api-keys", label: "API keys" },
      { href: "/admin/oauth-clients", label: "OAuth clients" },
      { href: "/admin/email-templates", label: "Email templates" },
      { href: "/admin/settings", label: "Settings" },
      { href: "/admin/audit-log", label: "Audit log" },
    ],
  },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();
  const companyName = await getSetting("company_name");
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
                {group.heading}
              </p>
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-lg px-3 py-1.5 text-sm hover:bg-slate-800 hover:text-white"
                >
                  {item.label}
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
              Client area
            </Link>
            <form action={logout}>
              <button type="submit" className="text-slate-400 hover:text-white">
                Sign out
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
