import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";

export const metadata = { title: "Invoices" };

export default async function InvoicesPage() {
  const user = await requireUser();
  const invoices = await db.invoice.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">Invoices</h1>
      <div className="card mt-6">
        <table className="table-base">
          <thead>
            <tr>
              <th>Invoice</th>
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
                    href={`/dashboard/invoices/${invoice.id}`}
                    className="font-medium text-brand-600 hover:underline"
                  >
                    #{invoice.number}
                  </Link>
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
                <td colSpan={5} className="py-8 text-center text-slate-400">
                  No invoices yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
