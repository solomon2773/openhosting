import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { db } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { enabledGateways } from "@/lib/extensions/registry";
import { StatusBadge } from "@/components/status-badge";
import { PayBox } from "./pay-box";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const t = await getT();
  const [settings, invoice, gateways] = await Promise.all([
    getSettings(["company_name", "company_url"]),
    db.invoice.findUnique({
      where: { id },
      include: { items: true, payments: true },
    }),
    enabledGateways(),
  ]);
  if (!invoice || (invoice.userId !== user.id && !user.roleId)) notFound();

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Invoice #{invoice.number}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {t("invoice.issued")} {formatDate(invoice.createdAt)} · {t("invoice.due")}{" "}
            {formatDate(invoice.dueAt)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`/invoices/${invoice.id}/print`}
            target="_blank"
            className="btn-secondary"
          >
            {t("invoice.printPdf")}
          </a>
          <StatusBadge status={invoice.status} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="card">
          <div className="border-b border-slate-100 px-5 py-4">
            <p className="font-semibold">{settings.company_name}</p>
            <p className="text-sm text-slate-500">
              {t("invoice.billedTo")}: {user.firstName} {user.lastName} ({user.email})
            </p>
          </div>
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
              <dt className="text-slate-500">{t("invoice.subtotal")}</dt>
              <dd>{formatMoney(invoice.subtotal, invoice.currency)}</dd>
            </div>
            {Number(invoice.discount) > 0 && (
              <div className="flex justify-between text-green-600">
                <dt>{t("invoice.discount")}</dt>
                <dd>-{formatMoney(invoice.discount, invoice.currency)}</dd>
              </div>
            )}
            {Number(invoice.tax) > 0 && (
              <div className="flex justify-between">
                <dt className="text-slate-500">{t("invoice.tax")}</dt>
                <dd>{formatMoney(invoice.tax, invoice.currency)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold">
              <dt>{t("invoice.total")}</dt>
              <dd>{formatMoney(invoice.total, invoice.currency)}</dd>
            </div>
          </dl>
        </div>

        <div className="space-y-4">
          {invoice.status === "PENDING" ? (
            <div className="card p-5">
              <h2 className="mb-3 font-semibold">{t("invoice.payTitle")}</h2>
              <PayBox
                invoiceId={invoice.id}
                total={Number(invoice.total)}
                currency={invoice.currency}
                credits={Number(user.credits)}
                gateways={gateways.map((g) => ({ slug: g.slug, name: g.name }))}
              />
            </div>
          ) : (
            <div className="card p-5">
              <h2 className="mb-2 font-semibold">{t("invoice.paymentTitle")}</h2>
              {invoice.payments.length === 0 ? (
                <p className="text-sm text-slate-500">{t("invoice.noPayments")}</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {invoice.payments.map((payment) => (
                    <li key={payment.id} className="flex justify-between">
                      <span className="text-slate-500">
                        {payment.gateway} · {formatDate(payment.createdAt)}
                      </span>
                      <span>
                        {formatMoney(payment.amount, payment.currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
