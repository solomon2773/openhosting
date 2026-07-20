import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { addBanRule, deleteBanRule, approveOrder, rejectOrder } from "@/lib/actions/fraud-affiliates";
import { ActionForm, SubmitButton } from "@/components/forms";

export const metadata = { title: "Fraud protection" };

export default async function AdminFraudPage() {
  await requireAdmin("fraud");
  const [rules, reviewQueue] = await Promise.all([
    db.banRule.findMany({ orderBy: { createdAt: "desc" } }),
    db.order.findMany({
      where: { reviewStatus: "PENDING_REVIEW" },
      orderBy: { createdAt: "asc" },
      include: { user: true, items: { include: { product: true } } },
    }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Fraud protection</h1>
      <p className="mt-1 text-sm text-slate-500">
        Thresholds, risk scoring keys and velocity limits live under{" "}
        <Link href="/admin/settings" className="text-brand-600 hover:underline">
          Settings → Fraud
        </Link>
        .
      </p>

      <div className="card mt-6">
        <h2 className="px-5 py-4 font-semibold">
          Review queue{" "}
          {reviewQueue.length > 0 && (
            <span className="badge ml-1 bg-amber-100 text-amber-700">
              {reviewQueue.length}
            </span>
          )}
        </h2>
        <table className="table-base">
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Risk</th>
              <th>Notes</th>
              <th className="text-right">Decision</th>
            </tr>
          </thead>
          <tbody>
            {reviewQueue.map((order) => (
              <tr key={order.id}>
                <td>
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="font-medium text-brand-600 hover:underline"
                  >
                    #{order.number}
                  </Link>
                  <p className="text-xs text-slate-400">
                    {formatDateTime(order.createdAt)} · {order.ip ?? "no ip"}
                  </p>
                </td>
                <td>
                  {order.user.firstName} {order.user.lastName}
                  <p className="text-xs text-slate-400">{order.user.email}</p>
                </td>
                <td className="max-w-40 truncate">
                  {order.items.map((i) => i.product.name).join(", ")}
                </td>
                <td>{order.riskScore ?? "—"}</td>
                <td className="max-w-52 text-xs text-slate-500">
                  {order.riskNotes ?? "—"}
                </td>
                <td>
                  <div className="flex justify-end gap-2">
                    <form action={approveOrder}>
                      <input type="hidden" name="id" value={order.id} />
                      <button type="submit" className="text-sm text-green-700 hover:underline">
                        Approve
                      </button>
                    </form>
                    <form action={rejectOrder}>
                      <input type="hidden" name="id" value={order.id} />
                      <button type="submit" className="text-sm text-red-600 hover:underline">
                        Reject
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {reviewQueue.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  Nothing awaiting review.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="card">
          <h2 className="px-5 py-4 font-semibold">Ban rules</h2>
          <table className="table-base">
            <thead>
              <tr>
                <th>Type</th>
                <th>Value</th>
                <th>Reason</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id}>
                  <td>
                    <span className="badge bg-slate-100 text-slate-600">
                      {rule.type.toLowerCase().replace("_", " ")}
                    </span>
                  </td>
                  <td className="font-mono text-xs">{rule.value}</td>
                  <td className="text-slate-500">{rule.reason ?? "—"}</td>
                  <td className="text-right">
                    <form action={deleteBanRule}>
                      <input type="hidden" name="id" value={rule.id} />
                      <button type="submit" className="text-sm text-red-600 hover:underline">
                        Delete
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {rules.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">
                    No ban rules. Disposable-email blocking is controlled in
                    Settings.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card h-fit p-5">
          <h2 className="mb-4 font-semibold">Add ban rule</h2>
          <ActionForm action={addBanRule}>
            <div>
              <label className="label">Type</label>
              <select name="type" className="input">
                <option value="EMAIL">Email address</option>
                <option value="EMAIL_DOMAIN">Email domain</option>
                <option value="IP">IP address</option>
                <option value="COUNTRY">Country (ISO code)</option>
              </select>
            </div>
            <div>
              <label className="label">Value</label>
              <input name="value" required className="input" placeholder="spam.example / 1.2.3.4 / RU" />
            </div>
            <div>
              <label className="label">Reason (optional)</label>
              <input name="reason" className="input" />
            </div>
            <SubmitButton className="btn-primary">Add rule</SubmitButton>
          </ActionForm>
        </div>
      </div>
    </div>
  );
}
