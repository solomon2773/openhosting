import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { db } from "@/lib/db";
import { formatDate, formatMoney, CYCLE_LABELS } from "@/lib/format";
import { getSetting } from "@/lib/settings";
import { StatusBadge } from "@/components/status-badge";
import { requestServiceCancellation, upgradeService } from "@/lib/actions/client";
import { ActionForm, SubmitButton } from "@/components/forms";
import { upgradeOptionsForService } from "@/lib/services/upgrades";

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const t = await getT();
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
  const upgrades = await upgradeOptionsForService(service.id);

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
          <h2 className="mb-4 font-semibold">{t("service.billing")}</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">{t("service.cycle")}</dt>
              <dd>{CYCLE_LABELS[service.cycle]}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">{t("table.price")}</dt>
              <dd>{formatMoney(service.price, currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">{t("service.registered")}</dt>
              <dd>{formatDate(service.createdAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">{t("service.nextDueDate")}</dt>
              <dd>{formatDate(service.expiresAt)}</dd>
            </div>
          </dl>
        </div>

        <div className="card p-5">
          <h2 className="mb-4 font-semibold">{t("service.configuration")}</h2>
          {config.length === 0 ? (
            <p className="text-sm text-slate-400">{t("service.noOptions")}</p>
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
        <h2 className="px-5 py-4 font-semibold">{t("service.relatedInvoices")}</h2>
        <table className="table-base">
          <thead>
            <tr>
              <th>{t("table.invoice")}</th>
              <th>{t("table.date")}</th>
              <th>{t("table.total")}</th>
              <th>{t("table.status")}</th>
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

      {upgrades.length > 0 && service.status === "ACTIVE" && (
        <div className="card mt-6 p-5">
          <h2 className="font-semibold">{t("service.upgradeTitle")}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {t("service.upgradeHint")}
          </p>
          <div className="mt-4 space-y-3">
            {upgrades.map((upgrade) => (
              <div
                key={upgrade.toProductId}
                className="flex items-center justify-between rounded-lg border border-slate-200 p-4"
              >
                <div>
                  <p className="font-medium">{upgrade.toProductName}</p>
                  <p className="text-sm text-slate-500">
                    {formatMoney(upgrade.newPrice, upgrade.currency)} /{" "}
                    {CYCLE_LABELS[service.cycle].toLowerCase()} ·{" "}
                    {upgrade.proratedCharge > 0
                      ? `${formatMoney(upgrade.proratedCharge, upgrade.currency)} ${t("service.dueNow")}`
                      : t("service.noCharge")}
                  </p>
                </div>
                <ActionForm action={upgradeService} className="m-0">
                  <input type="hidden" name="serviceId" value={service.id} />
                  <input
                    type="hidden"
                    name="toProductId"
                    value={upgrade.toProductId}
                  />
                  <SubmitButton className="btn-secondary">
                    {upgrade.proratedCharge > 0 ? t("service.upgrade") : t("service.switch")}
                  </SubmitButton>
                </ActionForm>
              </div>
            ))}
          </div>
        </div>
      )}

      {service.status !== "CANCELLED" &&
        (service.cancelAtPeriodEnd ? (
          <div className="card mt-6 border-amber-200 p-5">
            <p className="text-sm text-amber-700">
              {t("service.cancelScheduled")} ({formatDate(service.expiresAt)}).
            </p>
          </div>
        ) : (
          <div className="card mt-6 border-red-200 p-5">
            <h2 className="font-semibold text-red-700">{t("service.cancelTitle")}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {t("service.cancelHint")}
            </p>
            <ActionForm action={requestServiceCancellation} className="mt-4 space-y-3">
              <input type="hidden" name="serviceId" value={service.id} />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="mode"
                  value="end_of_term"
                  defaultChecked
                />
                {t("service.cancelEndOfTerm")} ({formatDate(service.expiresAt)})
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="mode" value="immediate" />
                {t("service.cancelImmediate")}
              </label>
              <SubmitButton className="btn-danger">
                {t("service.cancelButton")}
              </SubmitButton>
            </ActionForm>
          </div>
        ))}
    </div>
  );
}
