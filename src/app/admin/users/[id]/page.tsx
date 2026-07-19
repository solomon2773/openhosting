import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteUser, saveUser } from "@/lib/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { formatDate, formatMoney } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { getSetting } from "@/lib/settings";

export default async function AdminUserEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireAdmin("users");
  const { id } = await params;
  const isNew = id === "new";

  const [currency, roles, user] = await Promise.all([
    getSetting("currency"),
    db.role.findMany({ orderBy: { name: "asc" } }),
    isNew
      ? null
      : db.user.findUnique({
          where: { id },
          include: {
            role: true,
            services: { include: { product: true }, orderBy: { createdAt: "desc" } },
            invoices: { orderBy: { createdAt: "desc" }, take: 10 },
          },
        }),
  ]);
  if (!isNew && !user) notFound();

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {isNew ? "New user" : `${user!.firstName} ${user!.lastName}`}
        </h1>
        {!isNew && user!.id !== admin.id && (
          <form action={deleteUser}>
            <input type="hidden" name="id" value={user!.id} />
            <button type="submit" className="btn-danger">
              Delete user
            </button>
          </form>
        )}
      </div>

      <div className="card mt-6 p-6">
        <ActionForm action={saveUser}>
          {!isNew && <input type="hidden" name="id" value={user!.id} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">First name</label>
              <input name="firstName" defaultValue={user?.firstName} required className="input" />
            </div>
            <div>
              <label className="label">Last name</label>
              <input name="lastName" defaultValue={user?.lastName} required className="input" />
            </div>
            <div>
              <label className="label">Email</label>
              <input name="email" type="email" defaultValue={user?.email} required className="input" />
            </div>
            <div>
              <label className="label">Country (ISO)</label>
              <input name="country" defaultValue={user?.country ?? ""} className="input" />
            </div>
            <div>
              <label className="label">
                Password {isNew ? "" : "(leave blank to keep)"}
              </label>
              <input name="password" type="password" className="input" autoComplete="new-password" />
            </div>
            <div>
              <label className="label">Account credit ({currency})</label>
              <input
                name="credits"
                type="number"
                step="0.01"
                defaultValue={user ? Number(user.credits) : 0}
                className="input"
              />
            </div>
            <div>
              <label className="label">Staff role</label>
              <select name="roleId" className="input" defaultValue={user?.roleId ?? ""}>
                <option value="">None (client)</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <SubmitButton className="btn-primary">
            {isNew ? "Create user" : "Save user"}
          </SubmitButton>
        </ActionForm>
      </div>

      {!isNew && (
        <>
          <div className="card mt-8">
            <h2 className="px-5 py-4 font-semibold">Services</h2>
            <table className="table-base">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Price</th>
                  <th>Expires</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {user!.services.map((service) => (
                  <tr key={service.id}>
                    <td>{service.product.name}</td>
                    <td>{formatMoney(service.price, currency)}</td>
                    <td>{formatDate(service.expiresAt)}</td>
                    <td>
                      <StatusBadge status={service.status} />
                    </td>
                  </tr>
                ))}
                {user!.services.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400">
                      No services.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="card mt-8">
            <h2 className="px-5 py-4 font-semibold">Recent invoices</h2>
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
                {user!.invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>
                      <Link
                        href={`/admin/invoices/${invoice.id}`}
                        className="font-medium text-brand-600 hover:underline"
                      >
                        #{invoice.number}
                      </Link>
                    </td>
                    <td>{formatDate(invoice.createdAt)}</td>
                    <td>{formatMoney(invoice.total, invoice.currency)}</td>
                    <td>
                      <StatusBadge status={invoice.status} />
                    </td>
                  </tr>
                ))}
                {user!.invoices.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400">
                      No invoices.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
