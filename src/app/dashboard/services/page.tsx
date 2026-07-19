import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { db } from "@/lib/db";
import { formatDate, formatMoney, CYCLE_LABELS } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { getSetting } from "@/lib/settings";

export const metadata = { title: "Services" };

export default async function ServicesPage() {
  const user = await requireUser();
  const t = await getT();
  const [currency, services] = await Promise.all([
    getSetting("currency"),
    db.service.findMany({
      where: { userId: user.id },
      include: { product: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold">{t("services.title")}</h1>
      <div className="card mt-6">
        <table className="table-base">
          <thead>
            <tr>
              <th>{t("table.product")}</th>
              <th>{t("table.billing")}</th>
              <th>{t("table.price")}</th>
              <th>{t("table.nextDue")}</th>
              <th>{t("table.status")}</th>
            </tr>
          </thead>
          <tbody>
            {services.map((service) => (
              <tr key={service.id}>
                <td>
                  <Link
                    href={`/dashboard/services/${service.id}`}
                    className="font-medium text-brand-600 hover:underline"
                  >
                    {service.product.name}
                  </Link>
                </td>
                <td>{CYCLE_LABELS[service.cycle]}</td>
                <td>{formatMoney(service.price, currency)}</td>
                <td>{formatDate(service.expiresAt)}</td>
                <td>
                  <StatusBadge status={service.status} />
                </td>
              </tr>
            ))}
            {services.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400">
                  {t("services.empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
