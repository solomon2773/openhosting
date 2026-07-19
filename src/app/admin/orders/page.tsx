import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";

export const metadata = { title: "Orders" };

export default async function AdminOrdersPage() {
  await requireAdmin("orders");
  const orders = await db.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: true, items: { include: { product: true } } },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">Orders</h1>
      <div className="card mt-6">
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
            {orders.map((order) => (
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
                  <Link
                    href={`/admin/users/${order.userId}`}
                    className="hover:underline"
                  >
                    {order.user.firstName} {order.user.lastName}
                  </Link>
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
            {orders.length === 0 && (
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
