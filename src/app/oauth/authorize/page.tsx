import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { approveAuthorization } from "@/lib/actions/oauth";
import { SubmitButton } from "@/components/forms";
import {
  canonicalMcpResource,
  requestedOauthScopes,
} from "@/lib/oauth-policy";
import { publicUrl } from "@/lib/settings";

// OAuth2 authorization endpoint (authorization-code flow).
export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<{
    client_id?: string;
    redirect_uri?: string;
    state?: string;
    response_type?: string;
    scope?: string;
    resource?: string;
    code_challenge?: string;
    code_challenge_method?: string;
  }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const companyName = await getSetting("company_name");

  const client = params.client_id
    ? await db.oauthClient.findUnique({
        where: { clientId: params.client_id },
      })
    : null;
  const validRedirect =
    client && params.redirect_uri
      ? client.redirectUris.split("\n").includes(params.redirect_uri)
      : false;
  const scopes = client
    ? requestedOauthScopes(
        params.scope,
        client.allowedScopes as string[],
      )
    : null;
  const requestsMcp = scopes?.some((scope) => scope.startsWith("mcp:tool:"));
  const validResource = requestsMcp
    ? params.resource === canonicalMcpResource(await publicUrl())
    : true;
  if (
    !client ||
    !validRedirect ||
    params.response_type !== "code" ||
    params.code_challenge_method !== "S256" ||
    !params.code_challenge?.match(/^[A-Za-z0-9_-]{43}$/) ||
    !scopes ||
    !validResource
  ) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="card w-full max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold">Authorize {client.name}</h1>
        <p className="mt-3 text-sm text-slate-500">
          <strong>{client.name}</strong> wants access through your {companyName}
          account (<strong>{user.email}</strong>). Review the exact permissions
          before continuing.
        </p>
        <div className="mt-4 rounded-lg bg-slate-100 p-3 text-left text-xs text-slate-600">
          <p className="font-medium">Requested permissions</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {scopes.map((scope) => (
              <li key={scope}>{scope}</li>
            ))}
          </ul>
        </div>
        <form action={approveAuthorization} className="mt-6 space-y-3">
          <input type="hidden" name="client_id" value={params.client_id} />
          <input
            type="hidden"
            name="redirect_uri"
            value={params.redirect_uri}
          />
          <input type="hidden" name="state" value={params.state ?? ""} />
          <input type="hidden" name="scope" value={scopes.join(" ")} />
          <input type="hidden" name="resource" value={params.resource ?? ""} />
          <input
            type="hidden"
            name="code_challenge"
            value={params.code_challenge}
          />
          <SubmitButton className="btn-primary w-full">
            Authorize
          </SubmitButton>
          <a href="/dashboard" className="btn-secondary w-full">
            Cancel
          </a>
        </form>
      </div>
    </div>
  );
}
