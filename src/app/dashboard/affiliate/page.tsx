import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatDate, formatMoney } from "@/lib/format";
import { joinAffiliateProgram } from "@/lib/actions/fraud-affiliates";
import { SubmitButton } from "@/components/forms";

export const metadata = { title: "Affiliate program" };

export default async function AffiliatePage() {
  const user = await requireUser();
  const settings = await getSettings([
    "affiliate_enabled",
    "affiliate_commission_type",
    "affiliate_commission_value",
    "affiliate_recurring",
    "affiliate_payout_threshold",
    "company_url",
    "currency",
  ]);

  if (settings.affiliate_enabled !== "true") {
    return (
      <p className="text-slate-500">The affiliate program is not enabled.</p>
    );
  }

  const affiliate = await db.affiliate.findUnique({
    where: { userId: user.id },
    include: {
      commissions: { orderBy: { createdAt: "desc" }, take: 20 },
      _count: { select: { referred: true } },
    },
  });

  const commissionLabel =
    settings.affiliate_commission_type === "PERCENT"
      ? `${settings.affiliate_commission_value}%`
      : formatMoney(settings.affiliate_commission_value, settings.currency);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">Affiliate program</h1>
      <p className="mt-1 text-sm text-slate-500">
        Earn {commissionLabel}{" "}
        {settings.affiliate_recurring === "true"
          ? "on every invoice your referrals pay"
          : "on each referral's first paid invoice"}
        . Payouts from {formatMoney(settings.affiliate_payout_threshold, settings.currency)}.
      </p>

      {!affiliate ? (
        <form action={joinAffiliateProgram} className="card mt-6 p-8 text-center">
          <p className="text-slate-600">
            Join the program to get your personal referral link.
          </p>
          <SubmitButton className="btn-primary mt-4">
            Join the affiliate program
          </SubmitButton>
        </form>
      ) : (
        <>
          <div className="card mt-6 p-5">
            <p className="label">Your referral link</p>
            <code className="block rounded-lg bg-slate-100 px-3 py-2 text-sm break-all">
              {settings.company_url}/r/{affiliate.code}
            </code>
            <p className="mt-2 text-xs text-slate-400">
              Referrals are attributed for 30 days after a click (last click
              wins) and tied to the account created.
            </p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-4">
            {[
              { label: "Link visits", value: String(affiliate.visits) },
              { label: "Referred signups", value: String(affiliate._count.referred) },
              { label: "Total earned", value: formatMoney(affiliate.totalEarned, settings.currency) },
              { label: "Unpaid balance", value: formatMoney(affiliate.balance, settings.currency) },
            ].map((stat) => (
              <div key={stat.label} className="card p-4">
                <p className="text-xs text-slate-500">{stat.label}</p>
                <p className="mt-1 text-xl font-semibold">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="card mt-6">
            <h2 className="px-5 py-4 font-semibold">Recent commissions</h2>
            <table className="table-base">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {affiliate.commissions.map((commission) => (
                  <tr key={commission.id}>
                    <td>{formatDate(commission.createdAt)}</td>
                    <td>{formatMoney(commission.amount, settings.currency)}</td>
                    <td>
                      <span
                        className={`badge ${commission.status === "PAID" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}
                      >
                        {commission.status.toLowerCase()}
                      </span>
                    </td>
                  </tr>
                ))}
                {affiliate.commissions.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-slate-400">
                      No commissions yet — share your link!
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
