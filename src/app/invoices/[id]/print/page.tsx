import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";
import { getSettings } from "@/lib/settings";

// Print-ready invoice document — use the browser's Print → Save as PDF.
export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const [settings, invoice] = await Promise.all([
    getSettings(["company_name", "company_url"]),
    db.invoice.findUnique({
      where: { id },
      include: { user: true, items: true, payments: true },
    }),
  ]);
  if (!invoice || (invoice.userId !== user.id && !user.roleId)) notFound();
  const customer = invoice.user;

  return (
    <div className="mx-auto max-w-3xl bg-white p-10 text-slate-900 print:p-0">
      <p className="mb-6 rounded-lg bg-slate-100 px-4 py-2 text-center text-sm text-slate-500 print:hidden">
        Use your browser&apos;s Print (Ctrl/Cmd+P) to save this invoice as a
        PDF.
      </p>

      <header className="mb-10 flex items-start justify-between border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold">{settings.company_name}</h1>
          <p className="text-sm text-slate-500">{settings.company_url}</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-semibold">Invoice #{invoice.number}</p>
          <p className="text-sm text-slate-500">
            Issued {formatDate(invoice.createdAt)}
          </p>
          <p className="text-sm text-slate-500">
            Due {formatDate(invoice.dueAt)}
          </p>
          <p className="mt-1 text-sm font-medium uppercase">
            {invoice.status}
            {invoice.paidAt ? ` · ${formatDate(invoice.paidAt)}` : ""}
          </p>
        </div>
      </header>

      <section className="mb-8 text-sm">
        <p className="font-semibold text-slate-500 uppercase">Billed to</p>
        <p className="mt-1 font-medium">
          {customer.firstName} {customer.lastName}
          {customer.companyName ? ` · ${customer.companyName}` : ""}
        </p>
        <p className="text-slate-600">{customer.email}</p>
        {customer.address && (
          <p className="text-slate-600">
            {customer.address}, {customer.city} {customer.zip},{" "}
            {customer.country}
          </p>
        )}
      </section>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-300 text-xs text-slate-500 uppercase">
            <th className="py-2">Description</th>
            <th className="py-2 text-right">Qty</th>
            <th className="py-2 text-right">Unit price</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item) => (
            <tr key={item.id} className="border-b border-slate-100">
              <td className="py-2">{item.description}</td>
              <td className="py-2 text-right">{item.quantity}</td>
              <td className="py-2 text-right">
                {formatMoney(item.unitPrice, invoice.currency)}
              </td>
              <td className="py-2 text-right">
                {formatMoney(
                  Number(item.unitPrice) * item.quantity,
                  invoice.currency,
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="mt-4 ml-auto w-64 space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-500">Subtotal</dt>
          <dd>{formatMoney(invoice.subtotal, invoice.currency)}</dd>
        </div>
        {Number(invoice.discount) > 0 && (
          <div className="flex justify-between">
            <dt className="text-slate-500">Discount</dt>
            <dd>-{formatMoney(invoice.discount, invoice.currency)}</dd>
          </div>
        )}
        {Number(invoice.tax) > 0 && (
          <div className="flex justify-between">
            <dt className="text-slate-500">Tax</dt>
            <dd>{formatMoney(invoice.tax, invoice.currency)}</dd>
          </div>
        )}
        <div className="flex justify-between border-t border-slate-300 pt-1 text-base font-semibold">
          <dt>Total</dt>
          <dd>{formatMoney(invoice.total, invoice.currency)}</dd>
        </div>
      </dl>

      {invoice.payments.length > 0 && (
        <section className="mt-8 text-sm">
          <p className="font-semibold text-slate-500 uppercase">Payments</p>
          {invoice.payments.map((payment) => (
            <p key={payment.id} className="mt-1 text-slate-600">
              {formatDate(payment.createdAt)} — {payment.gateway} —{" "}
              {formatMoney(payment.amount, payment.currency)}
              {payment.transactionId ? ` (${payment.transactionId})` : ""}
            </p>
          ))}
        </section>
      )}

      <footer className="mt-12 border-t border-slate-200 pt-4 text-xs text-slate-400">
        Generated by {settings.company_name} · {settings.company_url}
      </footer>
    </div>
  );
}
