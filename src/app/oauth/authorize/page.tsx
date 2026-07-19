import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { approveAuthorization } from "@/lib/actions/oauth";
import { SubmitButton } from "@/components/forms";

// OAuth2 authorization endpoint (authorization-code flow).
export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<{
    client_id?: string;
    redirect_uri?: string;
    state?: string;
    response_type?: string;
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
  if (!client || !validRedirect || params.response_type !== "code") {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="card w-full max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold">Authorize {client.name}</h1>
        <p className="mt-3 text-sm text-slate-500">
          <strong>{client.name}</strong> wants to sign you in with your{" "}
          {companyName} account (<strong>{user.email}</strong>). It will
          receive your name and email address.
        </p>
        <form action={approveAuthorization} className="mt-6 space-y-3">
          <input type="hidden" name="client_id" value={params.client_id} />
          <input
            type="hidden"
            name="redirect_uri"
            value={params.redirect_uri}
          />
          <input type="hidden" name="state" value={params.state ?? ""} />
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
