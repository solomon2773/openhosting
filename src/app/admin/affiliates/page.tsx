import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { formatMoney } from "@/lib/format";
import { markAffiliatePaid } from "@/lib/actions/fraud-affiliates";

export const metadata = { title: "Affiliates" };

export default async function AdminAffiliatesPage() {
  await requireAdmin("affiliates");
  const [currency, threshold, affiliates] = await Promise.all([
    getSetting("currency"),
    getSetting("affiliate_payout_threshold"),
    db.affiliate.findMany({
      orderBy: { balance: "desc" },
      include: { user: true, _count: { select: { referred: true } } },
    }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Affiliates</h1>
      <p className="mt-1 text-sm text-slate-500">
        Payout threshold: {formatMoney(threshold, currency)} (Settings →
        Affiliate program). Mark an affiliate paid after sending their payout.
      </p>
      <div className="card mt-6">
        <table className="table-base">
          <thead>
            <tr>
              <th>Affiliate</th>
              <th>Code</th>
              <th>Visits</th>
              <th>Signups</th>
              <th>Total earned</th>
              <th>Unpaid</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {affiliates.map((affiliate) => (
              <tr key={affiliate.id}>
                <td>
                  <Link
                    href={`/admin/users/${affiliate.userId}`}
                    className="font-medium text-brand-600 hover:underline"
                  >
                    {affiliate.user.firstName} {affiliate.user.lastName}
                  </Link>
                </td>
                <td className="font-mono text-xs">{affiliate.code}</td>
                <td>{affiliate.visits}</td>
                <td>{affiliate._count.referred}</td>
                <td>{formatMoney(affiliate.totalEarned, currency)}</td>
                <td className="font-semibold">
                  {formatMoney(affiliate.balance, currency)}
                </td>
                <td className="text-right">
                  {Number(affiliate.balance) > 0 && (
                    <form action={markAffiliatePaid}>
                      <input type="hidden" name="id" value={affiliate.id} />
                      <button
                        type="submit"
                        className="text-sm text-brand-600 hover:underline"
                      >
                        Mark paid
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {affiliates.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400">
                  No affiliates yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
