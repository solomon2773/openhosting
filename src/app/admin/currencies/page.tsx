import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { deleteCurrency, saveCurrency } from "@/lib/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms";

export const metadata = { title: "Currencies" };

export default async function AdminCurrenciesPage() {
  await requireAdmin("settings");
  const [base, currencies] = await Promise.all([
    getSetting("currency"),
    db.currency.findMany({ orderBy: { code: "asc" } }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Currencies</h1>
      <p className="mt-1 text-sm text-slate-500">
        Base currency: <strong>{base}</strong> (set under Settings). Rates are
        units of the currency per 1 {base}; prices convert automatically and
        orders lock their currency at checkout.
      </p>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="card">
          <table className="table-base">
            <thead>
              <tr>
                <th>Code</th>
                <th>Symbol</th>
                <th>Rate (per 1 {base})</th>
                <th>Enabled</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {currencies.map((currency) => (
                <tr key={currency.code}>
                  <td className="font-mono font-medium">{currency.code}</td>
                  <td>{currency.symbol ?? "—"}</td>
                  <td>{Number(currency.rate)}</td>
                  <td>{currency.enabled ? "Yes" : "No"}</td>
                  <td className="text-right">
                    <form action={deleteCurrency}>
                      <input type="hidden" name="code" value={currency.code} />
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
              {currencies.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No additional currencies — customers pay in {base}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card h-fit p-5">
          <h2 className="mb-4 font-semibold">Add / update currency</h2>
          <ActionForm action={saveCurrency}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">ISO code</label>
                <input
                  name="code"
                  maxLength={3}
                  required
                  className="input uppercase"
                  placeholder="EUR"
                />
              </div>
              <div>
                <label className="label">Symbol</label>
                <input name="symbol" maxLength={4} className="input" placeholder="€" />
              </div>
            </div>
            <div>
              <label className="label">Rate (per 1 {base})</label>
              <input
                name="rate"
                type="number"
                step="0.000001"
                min="0.000001"
                required
                className="input"
                placeholder="0.92"
              />
            </div>
            <div className="flex items-center gap-2">
              <input id="enabled" name="enabled" type="checkbox" defaultChecked />
              <label htmlFor="enabled" className="text-sm">
                Enabled
              </label>
            </div>
            <SubmitButton className="btn-primary">Save currency</SubmitButton>
          </ActionForm>
        </div>
      </div>
    </div>
  );
}
