import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { deleteCoupon, saveCoupon } from "@/lib/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms";

export const metadata = { title: "Coupons" };

export default async function AdminCouponsPage() {
  await requireAdmin("coupons");
  const coupons = await db.coupon.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div>
      <h1 className="text-2xl font-bold">Coupons</h1>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="card">
          <table className="table-base">
            <thead>
              <tr>
                <th>Code</th>
                <th>Discount</th>
                <th>Uses</th>
                <th>Expires</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => (
                <tr key={coupon.id}>
                  <td className="font-mono font-medium">{coupon.code}</td>
                  <td>
                    {coupon.type === "PERCENT"
                      ? `${Number(coupon.value)}%`
                      : `$${Number(coupon.value)}`}
                  </td>
                  <td>
                    {coupon.uses}
                    {coupon.maxUses !== null && ` / ${coupon.maxUses}`}
                  </td>
                  <td>{formatDate(coupon.expiresAt)}</td>
                  <td className="text-right">
                    <form action={deleteCoupon}>
                      <input type="hidden" name="id" value={coupon.id} />
                      <button
                        type="submit"
                        className="text-sm text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {coupons.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No coupons yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card h-fit p-5">
          <h2 className="mb-4 font-semibold">New coupon</h2>
          <ActionForm action={saveCoupon}>
            <div>
              <label className="label">Code</label>
              <input name="code" required className="input uppercase" placeholder="WELCOME10" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Type</label>
                <select name="type" className="input">
                  <option value="PERCENT">Percent</option>
                  <option value="FIXED">Fixed amount</option>
                </select>
              </div>
              <div>
                <label className="label">Value</label>
                <input name="value" type="number" step="0.01" min="0" required className="input" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Max uses (blank = ∞)</label>
                <input name="maxUses" type="number" min="1" className="input" />
              </div>
              <div>
                <label className="label">Expires</label>
                <input name="expiresAt" type="date" className="input" />
              </div>
            </div>
            <SubmitButton className="btn-primary">Create coupon</SubmitButton>
          </ActionForm>
        </div>
      </div>
    </div>
  );
}
