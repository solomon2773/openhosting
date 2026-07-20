import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { createApiKey, revokeApiKey } from "@/lib/actions/api-keys";
import { ActionForm, SubmitButton } from "@/components/forms";

export const metadata = { title: "API keys" };

const PERMISSIONS = [
  "users:read",
  "users:write",
  "products:read",
  "orders:read",
  "invoices:read",
  "invoices:write",
  "services:read",
  "services:write",
  "usage:write",
  "coupons:read",
  "coupons:write",
  "quotes:read",
  "quotes:write",
  "knowledgebase:read",
  "tickets:read",
  "tickets:write",
];

export default async function AdminApiKeysPage() {
  await requireAdmin("api-keys");
  const keys = await db.apiKey.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: true },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">API keys</h1>
      <p className="mt-1 text-sm text-slate-500">
        Authenticate REST requests with{" "}
        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
          Authorization: Bearer oh_…
        </code>{" "}
        against <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">/api/v1</code>.
      </p>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="card">
          <table className="table-base">
            <thead>
              <tr>
                <th>Name</th>
                <th>Key</th>
                <th>Owner</th>
                <th>Last used</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id}>
                  <td className="font-medium">{key.name}</td>
                  <td>
                    <code className="text-xs text-slate-500">
                      {key.prefix}…
                    </code>
                  </td>
                  <td>
                    {key.user.firstName} {key.user.lastName}
                  </td>
                  <td>{formatDateTime(key.lastUsedAt)}</td>
                  <td className="text-right">
                    <form action={revokeApiKey}>
                      <input type="hidden" name="id" value={key.id} />
                      <button
                        type="submit"
                        className="text-sm text-red-600 hover:underline"
                      >
                        Revoke
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {keys.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No API keys yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card h-fit p-5">
          <h2 className="mb-4 font-semibold">New API key</h2>
          <ActionForm action={createApiKey}>
            <div>
              <label className="label">Name</label>
              <input name="name" required className="input" placeholder="CI integration" />
            </div>
            <fieldset>
              <legend className="label">Permissions (none = full access)</legend>
              <div className="space-y-1">
                {PERMISSIONS.map((permission) => (
                  <label
                    key={permission}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="permission"
                      value={permission}
                    />
                    <code className="text-xs">{permission}</code>
                  </label>
                ))}
              </div>
            </fieldset>
            <SubmitButton className="btn-primary">Create key</SubmitButton>
          </ActionForm>
        </div>
      </div>
    </div>
  );
}
