import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatMoney, CYCLE_LABELS } from "@/lib/format";
import { getSetting } from "@/lib/settings";
import { StatusBadge } from "@/components/status-badge";
import { requestServiceCancellation } from "@/lib/actions/client";
import { ActionForm, SubmitButton } from "@/components/forms";

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const [currency, service] = await Promise.all([
    getSetting("currency"),
    db.service.findUnique({
      where: { id },
      include: {
        product: true,
        invoiceItems: {
          include: { invoice: true },
          orderBy: { invoice: { createdAt: "desc" } },
        },
      },
    }),
  ]);
  if (!service || service.userId !== user.id) notFound();

  const config =
    (service.config as Array<{ option: string; label: string }> | null) ?? [];

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{service.product.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Service ID: {service.id}
          </p>
        </div>
        <StatusBadge status={service.status} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-4 font-semibold">Billing</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Billing cycle</dt>
              <dd>{CYCLE_LABELS[service.cycle]}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Price</dt>
              <dd>{formatMoney(service.price, currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Registered</dt>
              <dd>{formatDate(service.createdAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Next due date</dt>
              <dd>{formatDate(service.expiresAt)}</dd>
            </div>
          </dl>
        </div>

        <div className="card p-5">
          <h2 className="mb-4 font-semibold">Configuration</h2>
          {config.length === 0 ? (
            <p className="text-sm text-slate-400">No configurable options.</p>
          ) : (
            <dl className="space-y-2 text-sm">
              {config.map((c) => (
                <div key={c.option} className="flex justify-between">
                  <dt className="text-slate-500">{c.option}</dt>
                  <dd>{c.label}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>

      <div className="card mt-6">
        <h2 className="px-5 py-4 font-semibold">Related invoices</h2>
        <table className="table-base">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Date</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {service.invoiceItems.map((item) => (
              <tr key={item.id}>
                <td>
                  <a
                    href={`/dashboard/invoices/${item.invoice.id}`}
                    className="font-medium text-brand-600 hover:underline"
                  >
                    #{item.invoice.number}
                  </a>
                </td>
                <td>{formatDate(item.invoice.createdAt)}</td>
                <td>
                  {formatMoney(item.invoice.total, item.invoice.currency)}
                </td>
                <td>
                  <StatusBadge status={item.invoice.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {service.status !== "CANCELLED" && (
        <div className="card mt-6 border-red-200 p-5">
          <h2 className="font-semibold text-red-700">Cancel service</h2>
          <p className="mt-1 text-sm text-slate-500">
            Cancelling immediately stops this service and voids any open
            renewal invoices. This cannot be undone.
          </p>
          <ActionForm action={requestServiceCancellation} className="mt-4">
            <input type="hidden" name="serviceId" value={service.id} />
            <SubmitButton className="btn-danger">
              Cancel this service
            </SubmitButton>
          </ActionForm>
        </div>
      )}
    </div>
  );
}
