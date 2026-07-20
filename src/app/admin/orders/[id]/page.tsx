import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime, formatMoney, CYCLE_LABELS } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { approveOrder, rejectOrder } from "@/lib/actions/fraud-affiliates";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin("orders");
  const { id } = await params;
  const order = await db.order.findUnique({
    where: { id },
    include: {
      user: true,
      coupon: true,
      items: { include: { product: true } },
      services: { include: { product: true } },
      invoices: true,
    },
  });
  if (!order) notFound();

  return (
    <div className="max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Order #{order.number}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {formatDateTime(order.createdAt)} ·{" "}
            <Link
              href={`/admin/users/${order.userId}`}
              className="text-brand-600 hover:underline"
            >
              {order.user.firstName} {order.user.lastName}
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {order.reviewStatus === "PENDING_REVIEW" && (
            <>
              <span className="badge bg-amber-100 text-amber-700">
                fraud review · score {order.riskScore ?? "—"}
              </span>
              <form action={approveOrder}>
                <input type="hidden" name="id" value={order.id} />
                <button type="submit" className="btn-primary">Approve</button>
              </form>
              <form action={rejectOrder}>
                <input type="hidden" name="id" value={order.id} />
                <button type="submit" className="btn-danger">Reject</button>
              </form>
            </>
          )}
          {order.reviewStatus === "REJECTED" && (
            <span className="badge bg-red-100 text-red-700">rejected (fraud)</span>
          )}
          <StatusBadge status={order.status} />
        </div>
      </div>

      <div className="card mt-6">
        <table className="table-base">
          <thead>
            <tr>
              <th>Product</th>
              <th>Cycle</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Unit</th>
              <th className="text-right">Setup</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <td>{item.product.name}</td>
                <td>{CYCLE_LABELS[item.cycle]}</td>
                <td className="text-right">{item.quantity}</td>
                <td className="text-right">
                  {formatMoney(item.unitPrice, order.currency)}
                </td>
                <td className="text-right">
                  {formatMoney(item.setupFee, order.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="space-y-1 px-5 py-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Subtotal</dt>
            <dd>{formatMoney(order.subtotal, order.currency)}</dd>
          </div>
          {Number(order.discount) > 0 && (
            <div className="flex justify-between text-green-600">
              <dt>Discount {order.coupon ? `(${order.coupon.code})` : ""}</dt>
              <dd>-{formatMoney(order.discount, order.currency)}</dd>
            </div>
          )}
          {Number(order.tax) > 0 && (
            <div className="flex justify-between">
              <dt className="text-slate-500">Tax</dt>
              <dd>{formatMoney(order.tax, order.currency)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold">
            <dt>Total</dt>
            <dd>{formatMoney(order.total, order.currency)}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 font-semibold">Services</h2>
          <ul className="space-y-2 text-sm">
            {order.services.map((service) => (
              <li key={service.id} className="flex justify-between">
                <span>{service.product.name}</span>
                <StatusBadge status={service.status} />
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-5">
          <h2 className="mb-3 font-semibold">Invoices</h2>
          <ul className="space-y-2 text-sm">
            {order.invoices.map((invoice) => (
              <li key={invoice.id} className="flex justify-between">
                <Link
                  href={`/admin/invoices/${invoice.id}`}
                  className="text-brand-600 hover:underline"
                >
                  #{invoice.number}
                </Link>
                <StatusBadge status={invoice.status} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
