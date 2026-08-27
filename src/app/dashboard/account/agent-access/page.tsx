import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { getEnabledCurrencies } from "@/lib/services/currency";
import { formatDateTime, formatMoney } from "@/lib/format";
import {
  createAgentGrant,
  revokeAgentGrant,
} from "@/lib/actions/agent-grants";
import { ActionForm, SubmitButton } from "@/components/forms";

export const metadata = { title: "Agent access" };

function list(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export default async function AgentAccessPage() {
  const user = await requireUser();
  const [baseCurrency, currencies, products, grants] = await Promise.all([
    getSetting("currency"),
    getEnabledCurrencies(),
    db.product.findMany({
      where: { hidden: false },
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
      include: { category: true },
    }),
    db.agentGrant.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Agent purchasing access</h1>
      <p className="mt-1 max-w-3xl text-sm text-slate-500">
        Delegate checkout to an agent without sharing your password. Every token
        has an expiry, an exact product and currency allowlist, and base-currency
        spend caps. Tokens are shown only once.
      </p>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Name</th>
                <th>Token</th>
                <th>Limits ({baseCurrency})</th>
                <th>Scope</th>
                <th>Expires</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {grants.map((grant) => (
                <tr key={grant.id}>
                  <td className="font-medium">{grant.name}</td>
                  <td className="font-mono text-xs">{grant.prefix}…</td>
                  <td className="text-xs">
                    {formatMoney(grant.maxPerOrderBase, baseCurrency)} / order
                    <br />
                    {formatMoney(grant.committedBase, baseCurrency)} of{" "}
                    {formatMoney(grant.spendLimitBase, baseCurrency)} committed
                  </td>
                  <td className="max-w-52 text-xs">
                    {list(grant.allowedProductIds).length} product(s)
                    <br />
                    {list(grant.allowedCurrencies).join(", ")}
                  </td>
                  <td className="text-xs">
                    {grant.revokedAt ? "Revoked" : formatDateTime(grant.expiresAt)}
                  </td>
                  <td className="text-right">
                    {!grant.revokedAt && (
                      <form action={revokeAgentGrant}>
                        <input type="hidden" name="id" value={grant.id} />
                        <button className="text-sm text-red-600 hover:underline">
                          Revoke
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
              {grants.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No purchasing grants yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card h-fit p-5">
          <h2 className="mb-4 font-semibold">New purchasing grant</h2>
          <ActionForm action={createAgentGrant}>
            <div>
              <label className="label">Name</label>
              <input name="name" required className="input" placeholder="Deployment agent" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Max per order ({baseCurrency})</label>
                <input name="maxPerOrderBase" type="number" min="0.01" step="0.01" required className="input" />
              </div>
              <div>
                <label className="label">Total limit ({baseCurrency})</label>
                <input name="spendLimitBase" type="number" min="0.01" step="0.01" required className="input" />
              </div>
            </div>
            <div>
              <label className="label">Expires in days</label>
              <input name="expiresInDays" type="number" min="1" max="90" step="1" defaultValue="30" required className="input" />
            </div>
            <fieldset>
              <legend className="label">Allowed currencies</legend>
              <div className="flex flex-wrap gap-3">
                {currencies.map((currency) => (
                  <label key={currency.code} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="currency" value={currency.code} />
                    {currency.code}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="label">Allowed products</legend>
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-3">
                {products.map((product) => (
                  <label key={product.id} className="flex items-start gap-2 text-sm">
                    <input className="mt-1" type="checkbox" name="productId" value={product.id} />
                    <span>{product.category.name} / {product.name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <SubmitButton className="btn-primary">Create token</SubmitButton>
          </ActionForm>
        </div>
      </div>
    </div>
  );
}
