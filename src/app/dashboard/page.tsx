import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { db } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const t = await getT();
  const [activeServices, unpaidInvoices, openTickets, recentInvoices] =
    await Promise.all([
      db.service.count({ where: { userId: user.id, status: "ACTIVE" } }),
      db.invoice.count({ where: { userId: user.id, status: "PENDING" } }),
      db.ticket.count({
        where: { userId: user.id, status: { not: "CLOSED" } },
      }),
      db.invoice.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

  const stats = [
    { label: t("dash.stat.activeServices"), value: activeServices, href: "/dashboard/services" },
    { label: t("dash.stat.unpaidInvoices"), value: unpaidInvoices, href: "/dashboard/invoices" },
    { label: t("dash.stat.openTickets"), value: openTickets, href: "/dashboard/tickets" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold">
        {t("dash.welcome")} {user.firstName}
      </h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href} className="card p-5 hover:shadow-md">
            <p className="text-sm text-slate-500">{stat.label}</p>
            <p className="mt-1 text-3xl font-semibold">{stat.value}</p>
          </Link>
        ))}
      </div>

      <div className="card mt-8">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="font-semibold">{t("dash.recentInvoices")}</h2>
          <Link
            href="/dashboard/invoices"
            className="text-sm text-brand-600 hover:underline"
          >
            {t("dash.viewAll")}
          </Link>
        </div>
        <table className="table-base">
          <thead>
            <tr>
              <th>{t("table.invoice")}</th>
              <th>{t("table.date")}</th>
              <th>{t("table.total")}</th>
              <th>{t("table.status")}</th>
            </tr>
          </thead>
          <tbody>
            {recentInvoices.map((invoice) => (
              <tr key={invoice.id}>
                <td>
                  <Link
                    href={`/dashboard/invoices/${invoice.id}`}
                    className="font-medium text-brand-600 hover:underline"
                  >
                    #{invoice.number}
                  </Link>
                </td>
                <td>{formatDate(invoice.createdAt)}</td>
                <td>{formatMoney(invoice.total, invoice.currency)}</td>
                <td>
                  <StatusBadge status={invoice.status} />
                </td>
              </tr>
            ))}
            {recentInvoices.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-slate-400">
                  {t("dash.noInvoices")}{" "}
                  <Link href="/" className="text-brand-600 hover:underline">
                    {t("dash.orderFirst")}
                  </Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
