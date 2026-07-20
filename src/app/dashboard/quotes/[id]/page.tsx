import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";
import { acceptQuote, declineQuote } from "@/lib/actions/quotes";

export default async function ClientQuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const quote = await db.quote.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!quote || quote.userId !== user.id || quote.status === "DRAFT") notFound();

  const expired =
    quote.validUntil && quote.validUntil < new Date() && quote.status === "SENT";
  const canRespond = quote.status === "SENT" && !expired;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold">Quote #{quote.number}</h1>
      <p className="mt-1 text-sm text-slate-500">
        {quote.validUntil && <>Valid until {formatDate(quote.validUntil)} · </>}
        {expired ? "expired" : quote.status.toLowerCase()}
      </p>

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
          <p className="text-sm whitespace-pre-line text-slate-600">{quote.notes}</p>
        </div>
      )}

      {canRespond && (
        <div className="mt-6 flex gap-3">
          <form action={acceptQuote}>
            <input type="hidden" name="id" value={quote.id} />
            <button type="submit" className="btn-primary">
              Accept &amp; generate invoice
            </button>
          </form>
          <form action={declineQuote}>
            <input type="hidden" name="id" value={quote.id} />
            <button type="submit" className="btn-secondary">Decline</button>
          </form>
        </div>
      )}
      {quote.status === "ACCEPTED" && quote.invoiceId && (
        <a href={`/dashboard/invoices/${quote.invoiceId}`} className="btn-primary mt-6">
          View invoice
        </a>
      )}
    </div>
  );
}
