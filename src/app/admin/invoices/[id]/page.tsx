import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { adminCancelInvoice, adminMarkInvoicePaid } from "@/lib/actions/admin";

export default async function AdminInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin("invoices");
  const { id } = await params;
  const invoice = await db.invoice.findUnique({
    where: { id },
    include: { user: true, items: true, payments: true },
  });
  if (!invoice) notFound();

  return (
    <div className="max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Invoice #{invoice.number}</h1>
          <p className="mt-1 text-sm text-slate-500">
            <Link
              href={`/admin/users/${invoice.userId}`}
              className="text-brand-600 hover:underline"
            >
              {invoice.user.firstName} {invoice.user.lastName}
            </Link>{" "}
            · Issued {formatDate(invoice.createdAt)} · Due{" "}
            {formatDate(invoice.dueAt)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={invoice.status} />
          {invoice.status === "PENDING" && (
            <>
              <form action={adminMarkInvoicePaid}>
                <input type="hidden" name="id" value={invoice.id} />
                <button type="submit" className="btn-primary">
                  Mark paid
                </button>
              </form>
              <form action={adminCancelInvoice}>
                <input type="hidden" name="id" value={invoice.id} />
                <button type="submit" className="btn-secondary">
                  Cancel
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      <div className="card mt-6">
        <table className="table-base">
          <thead>
            <tr>
              <th>Description</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Unit</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id}>
                <td>{item.description}</td>
                <td className="text-right">{item.quantity}</td>
                <td className="text-right">
                  {formatMoney(item.unitPrice, invoice.currency)}
                </td>
                <td className="text-right">
                  {formatMoney(
                    Number(item.unitPrice) * item.quantity,
                    invoice.currency,
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="space-y-1 px-5 py-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Subtotal</dt>
            <dd>{formatMoney(invoice.subtotal, invoice.currency)}</dd>
          </div>
          {Number(invoice.discount) > 0 && (
            <div className="flex justify-between text-green-600">
              <dt>Discount</dt>
              <dd>-{formatMoney(invoice.discount, invoice.currency)}</dd>
            </div>
          )}
          {Number(invoice.tax) > 0 && (
            <div className="flex justify-between">
              <dt className="text-slate-500">Tax</dt>
              <dd>{formatMoney(invoice.tax, invoice.currency)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold">
            <dt>Total</dt>
            <dd>{formatMoney(invoice.total, invoice.currency)}</dd>
          </div>
        </dl>
      </div>

      <div className="card mt-6">
        <h2 className="px-5 py-4 font-semibold">Payments</h2>
        <table className="table-base">
          <thead>
            <tr>
              <th>Gateway</th>
              <th>Transaction</th>
              <th>Date</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {invoice.payments.map((payment) => (
              <tr key={payment.id}>
                <td>{payment.gateway}</td>
                <td className="max-w-48 truncate text-slate-500">
                  {payment.transactionId ?? "—"}
                </td>
                <td>{formatDateTime(payment.createdAt)}</td>
                <td>{formatMoney(payment.amount, payment.currency)}</td>
                <td>
                  <StatusBadge status={payment.status} />
                </td>
              </tr>
            ))}
            {invoice.payments.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-400">
                  No payments recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
