import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";
import { getSetting } from "@/lib/settings";
import { StatusBadge } from "@/components/status-badge";

export const metadata = { title: "Admin dashboard" };

export default async function AdminDashboardPage() {
  await requireAdmin();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [currency, revenueAgg, pendingInvoices, activeServices, openTickets, userCount, recentOrders] =
    await Promise.all([
      getSetting("currency"),
      db.payment.aggregate({
        _sum: { amount: true },
        where: { status: "COMPLETED", createdAt: { gte: monthStart } },
      }),
      db.invoice.count({ where: { status: "PENDING" } }),
      db.service.count({ where: { status: "ACTIVE" } }),
      db.ticket.count({ where: { status: { not: "CLOSED" } } }),
      db.user.count(),
      db.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { user: true, items: { include: { product: true } } },
      }),
    ]);

  const stats = [
    {
      label: "Revenue this month",
      value: formatMoney(revenueAgg._sum.amount ?? 0, currency),
    },
    { label: "Active services", value: String(activeServices) },
    { label: "Unpaid invoices", value: String(pendingInvoices) },
    { label: "Open tickets", value: String(openTickets) },
    { label: "Customers", value: String(userCount) },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.label} className="card p-4">
            <p className="text-xs text-slate-500">{stat.label}</p>
            <p className="mt-1 text-2xl font-semibold">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="card mt-8">
        <h2 className="px-5 py-4 font-semibold">Recent orders</h2>
        <table className="table-base">
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Total</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {recentOrders.map((order) => (
              <tr key={order.id}>
                <td>
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="font-medium text-brand-600 hover:underline"
                  >
                    #{order.number}
                  </Link>
                </td>
                <td>
                  {order.user.firstName} {order.user.lastName}
                </td>
                <td className="max-w-56 truncate">
                  {order.items.map((i) => i.product.name).join(", ")}
                </td>
                <td>{formatMoney(order.total, order.currency)}</td>
                <td>{formatDate(order.createdAt)}</td>
                <td>
                  <StatusBadge status={order.status} />
                </td>
              </tr>
            ))}
            {recentOrders.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  No orders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
