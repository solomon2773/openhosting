import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { createOauthClient, deleteOauthClient } from "@/lib/actions/oauth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { MCP_TOOL_SCOPES } from "@/lib/oauth-policy";

export const metadata = { title: "OAuth clients" };

export default async function AdminOauthClientsPage() {
  await requireAdmin("oauth");
  const clients = await db.oauthClient.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { tokens: true } } },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">OAuth clients</h1>
      <p className="mt-1 text-sm text-slate-500">
        Let other applications sign users in with their OpenHosting account.
        Authorize URL: <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">/oauth/authorize</code>{" "}
        · Token: <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">/oauth/token</code>{" "}
        · Userinfo: <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">/oauth/userinfo</code>
      </p>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="card">
          <table className="table-base">
            <thead>
              <tr>
                <th>Name</th>
                <th>Client ID</th>
                <th>Type</th>
                <th>Tokens</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id}>
                  <td className="font-medium">{client.name}</td>
                  <td>
                    <code className="text-xs text-slate-500">
                      {client.clientId}
                    </code>
                  </td>
                  <td>{client.publicClient ? "Public PKCE" : "Confidential"}</td>
                  <td>{client._count.tokens}</td>
                  <td>{formatDate(client.createdAt)}</td>
                  <td className="text-right">
                    <form action={deleteOauthClient}>
                      <input type="hidden" name="id" value={client.id} />
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
              {clients.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No OAuth clients yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card h-fit p-5">
          <h2 className="mb-4 font-semibold">New OAuth client</h2>
          <ActionForm action={createOauthClient}>
            <div>
              <label className="label">Application name</label>
              <input name="name" required className="input" />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input name="publicClient" type="checkbox" className="mt-1" />
              <span>
                Public PKCE client (no secret)
                <span className="block text-xs text-slate-500">
                  Use for installed, browser, and general-purpose MCP clients.
                </span>
              </span>
            </label>
            <div>
              <label className="label">Allowed scopes (space-separated)</label>
              <textarea
                name="allowedScopes"
                rows={7}
                required
                className="input font-mono text-xs"
                defaultValue="openid profile email"
              />
              <details className="mt-2 text-xs text-slate-500">
                <summary className="cursor-pointer">Available MCP tool scopes</summary>
                <code className="mt-2 block whitespace-pre-wrap">
                  {MCP_TOOL_SCOPES.join(" ")}
                </code>
              </details>
            </div>
            <div>
              <label className="label">Redirect URIs (one per line)</label>
              <textarea
                name="redirectUris"
                rows={3}
                required
                className="input font-mono text-xs"
                placeholder="https://app.example.com/auth/callback"
              />
            </div>
            <SubmitButton className="btn-primary">Create client</SubmitButton>
          </ActionForm>
        </div>
      </div>
    </div>
  );
}
