import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";

export const metadata = { title: "Invoices" };

export default async function AdminInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin("invoices");
  const { status } = await searchParams;
  const invoices = await db.invoice.findMany({
    where:
      status && ["PENDING", "PAID", "CANCELLED", "REFUNDED"].includes(status)
        ? { status: status as never }
        : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: true },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Invoices</h1>
        <div className="flex gap-2 text-sm">
          {["ALL", "PENDING", "PAID", "CANCELLED"].map((s) => (
            <Link
              key={s}
              href={s === "ALL" ? "/admin/invoices" : `/admin/invoices?status=${s}`}
              className={`rounded-full px-3 py-1 ${
                (s === "ALL" && !status) || status === s
                  ? "bg-brand-600 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              {s.toLowerCase()}
            </Link>
          ))}
        </div>
      </div>
      <div className="card mt-6">
        <table className="table-base">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Customer</th>
              <th>Created</th>
              <th>Due</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id}>
                <td>
                  <Link
                    href={`/admin/invoices/${invoice.id}`}
                    className="font-medium text-brand-600 hover:underline"
                  >
                    #{invoice.number}
                  </Link>
                </td>
                <td>
                  {invoice.user.firstName} {invoice.user.lastName}
                </td>
                <td>{formatDate(invoice.createdAt)}</td>
                <td>{formatDate(invoice.dueAt)}</td>
                <td>{formatMoney(invoice.total, invoice.currency)}</td>
                <td>
                  <StatusBadge status={invoice.status} />
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  No invoices.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
