import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteTaxRate, saveTaxRate } from "@/lib/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms";

export const metadata = { title: "Tax rates" };

export default async function AdminTaxesPage() {
  await requireAdmin("settings");
  const rates = await db.taxRate.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <h1 className="text-2xl font-bold">Tax rates</h1>
      <p className="mt-1 text-sm text-slate-500">
        A rate with a country applies to customers from that country; a rate
        without one is the fallback. Enable tax in Settings.
      </p>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="card">
          <table className="table-base">
            <thead>
              <tr>
                <th>Name</th>
                <th>Rate</th>
                <th>Country</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rates.map((rate) => (
                <tr key={rate.id}>
                  <td className="font-medium">{rate.name}</td>
                  <td>{Number(rate.rate)}%</td>
                  <td>{rate.country ?? "All (fallback)"}</td>
                  <td className="text-right">
                    <form action={deleteTaxRate}>
                      <input type="hidden" name="id" value={rate.id} />
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
              {rates.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">
                    No tax rates defined.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card h-fit p-5">
          <h2 className="mb-4 font-semibold">New tax rate</h2>
          <ActionForm action={saveTaxRate}>
            <div>
              <label className="label">Name</label>
              <input name="name" required className="input" placeholder="VAT" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Rate (%)</label>
                <input
                  name="rate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  required
                  className="input"
                />
              </div>
              <div>
                <label className="label">Country (blank = all)</label>
                <input name="country" maxLength={2} className="input uppercase" placeholder="NL" />
              </div>
            </div>
            <SubmitButton className="btn-primary">Add tax rate</SubmitButton>
          </ActionForm>
        </div>
      </div>
    </div>
  );
}
