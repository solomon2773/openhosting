import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { logout } from "@/lib/actions/auth";
import { formatMoney } from "@/lib/format";
import { unreadCount } from "@/lib/services/notifications";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/services", label: "Services" },
  { href: "/dashboard/invoices", label: "Invoices" },
  { href: "/dashboard/tickets", label: "Support" },
  { href: "/dashboard/account/billing", label: "Billing" },
  { href: "/dashboard/account", label: "Account" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const [companyName, currency, unread] = await Promise.all([
    getSetting("company_name"),
    getSetting("currency"),
    unreadCount(user.id),
  ]);

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <Link href="/" className="flex items-center gap-2 px-6 py-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            {companyName.charAt(0)}
          </span>
          <span className="font-semibold">{companyName}</span>
        </Link>
        <nav className="flex-1 space-y-1 px-3 py-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/dashboard/notifications"
            className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            Notifications
            {unread > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs font-semibold text-white">
                {unread}
              </span>
            )}
          </Link>
          {user.roleId && (
            <Link
              href="/admin"
              className="block rounded-lg px-3 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50"
            >
              Admin panel →
            </Link>
          )}
        </nav>
        <div className="border-t border-slate-200 p-4">
          <p className="truncate text-sm font-medium">
            {user.firstName} {user.lastName}
          </p>
          <p className="truncate text-xs text-slate-500">{user.email}</p>
          <p className="mt-1 text-xs text-slate-500">
            Credit: {formatMoney(user.credits, currency)}
          </p>
          <form action={logout} className="mt-3">
            <button
              type="submit"
              className="text-sm text-slate-500 hover:text-slate-900"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <Link href="/" className="font-semibold">
            {companyName}
          </Link>
          <nav className="flex gap-4 text-sm">
            {NAV.slice(0, 4).map((item) => (
              <Link key={item.href} href={item.href} className="text-slate-600">
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8 md:px-8">{children}</main>
      </div>
    </div>
  );
}
