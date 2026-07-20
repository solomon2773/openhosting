import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";
import { deleteQuote, sendQuote } from "@/lib/actions/quotes";

export default async function AdminQuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin("quotes");
  const { id } = await params;
  const quote = await db.quote.findUnique({
    where: { id },
    include: { user: true, items: true },
  });
  if (!quote) notFound();

  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Quote #{quote.number}</h1>
          <p className="mt-1 text-sm text-slate-500">
            <Link href={`/admin/users/${quote.userId}`} className="text-brand-600 hover:underline">
              {quote.user.firstName} {quote.user.lastName}
            </Link>{" "}
            · {quote.status.toLowerCase()}
            {quote.validUntil && <> · valid until {formatDate(quote.validUntil)}</>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {quote.status === "DRAFT" && (
            <form action={sendQuote}>
              <input type="hidden" name="id" value={quote.id} />
              <button type="submit" className="btn-primary">Send to customer</button>
            </form>
          )}
          {quote.invoiceId && (
            <Link href={`/admin/invoices/${quote.invoiceId}`} className="btn-secondary">
              View invoice
            </Link>
          )}
          <form action={deleteQuote}>
            <input type="hidden" name="id" value={quote.id} />
            <button type="submit" className="btn-danger">Delete</button>
          </form>
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
            {quote.items.map((item) => (
              <tr key={item.id}>
                <td>{item.description}</td>
                <td className="text-right">{item.quantity}</td>
                <td className="text-right">{formatMoney(item.unitPrice, quote.currency)}</td>
                <td className="text-right">
                  {formatMoney(Number(item.unitPrice) * item.quantity, quote.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-between border-t border-slate-200 px-5 py-4 font-semibold">
          <span>Total</span>
          <span>{formatMoney(quote.total, quote.currency)}</span>
        </div>
      </div>

      {quote.notes && (
        <div className="card mt-6 p-5">
          <h2 className="mb-2 font-semibold">Notes</h2>
          <p className="text-sm whitespace-pre-line text-slate-600">{quote.notes}</p>
        </div>
      )}
    </div>
  );
}
