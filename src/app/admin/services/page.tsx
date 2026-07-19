import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";
import { getSetting } from "@/lib/settings";
import { StatusBadge } from "@/components/status-badge";
import { adminServiceAction } from "@/lib/actions/admin";

export const metadata = { title: "Services" };

const ACTIONS: Record<string, { action: string; label: string }[]> = {
  PENDING: [{ action: "activate", label: "Activate" }],
  ACTIVE: [
    { action: "suspend", label: "Suspend" },
    { action: "terminate", label: "Terminate" },
  ],
  SUSPENDED: [
    { action: "unsuspend", label: "Unsuspend" },
    { action: "terminate", label: "Terminate" },
  ],
  CANCELLED: [],
  EXPIRED: [],
};

export default async function AdminServicesPage() {
  await requireAdmin("services");
  const [currency, services] = await Promise.all([
    getSetting("currency"),
    db.service.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: true, product: true },
    }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Services</h1>
      <div className="card mt-6">
        <table className="table-base">
          <thead>
            <tr>
              <th>Product</th>
              <th>Customer</th>
              <th>Price</th>
              <th>Expires</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {services.map((service) => (
              <tr key={service.id}>
                <td className="font-medium">{service.product.name}</td>
                <td>
                  <Link
                    href={`/admin/users/${service.userId}`}
                    className="hover:underline"
                  >
                    {service.user.firstName} {service.user.lastName}
                  </Link>
                </td>
                <td>{formatMoney(service.price, currency)}</td>
                <td>{formatDate(service.expiresAt)}</td>
                <td>
                  <StatusBadge status={service.status} />
                </td>
                <td>
                  <div className="flex justify-end gap-2">
                    {ACTIONS[service.status]?.map(({ action, label }) => (
                      <form key={action} action={adminServiceAction}>
                        <input type="hidden" name="id" value={service.id} />
                        <input
                          type="hidden"
                          name="serviceAction"
                          value={action}
                        />
                        <button
                          type="submit"
                          className={
                            action === "terminate"
                              ? "text-sm text-red-600 hover:underline"
                              : "text-sm text-brand-600 hover:underline"
                          }
                        >
                          {label}
                        </button>
                      </form>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {services.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  No services.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
