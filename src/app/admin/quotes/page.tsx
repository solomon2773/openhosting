import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";

export const metadata = { title: "Quotes" };

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  SENT: "bg-blue-100 text-blue-700",
  ACCEPTED: "bg-green-100 text-green-700",
  DECLINED: "bg-red-100 text-red-700",
  EXPIRED: "bg-slate-100 text-slate-500",
};

export default async function AdminQuotesPage() {
  await requireAdmin("quotes");
  const quotes = await db.quote.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: true },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Quotes</h1>
        <Link href="/admin/quotes/new" className="btn-primary">
          New quote
        </Link>
      </div>
      <div className="card mt-6">
        <table className="table-base">
          <thead>
            <tr>
              <th>Quote</th>
              <th>Customer</th>
              <th>Total</th>
              <th>Valid until</th>
              <th>Created</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((quote) => (
              <tr key={quote.id}>
                <td>
                  <Link
                    href={`/admin/quotes/${quote.id}`}
                    className="font-medium text-brand-600 hover:underline"
                  >
                    #{quote.number}
                  </Link>
                </td>
                <td>
                  {quote.user.firstName} {quote.user.lastName}
                </td>
                <td>{formatMoney(quote.total, quote.currency)}</td>
                <td>{formatDate(quote.validUntil)}</td>
                <td>{formatDate(quote.createdAt)}</td>
                <td>
                  <span className={`badge ${STATUS_STYLES[quote.status]}`}>
                    {quote.status.toLowerCase()}
                  </span>
                </td>
              </tr>
            ))}
            {quotes.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  No quotes yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
