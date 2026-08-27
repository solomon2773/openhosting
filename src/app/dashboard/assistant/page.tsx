import { CustomerAssistant } from "@/components/customer-assistant";
import { requireUser } from "@/lib/auth";
import { customerAssistantEnabled } from "@/lib/services/ai";

export const metadata = { title: "AI assistant" };

export default async function CustomerAssistantPage() {
  await requireUser();
  const enabled = await customerAssistantEnabled();

  return (
    <div>
      <h1 className="text-2xl font-bold">AI assistant</h1>
      <p className="mt-1 text-sm text-slate-500">
        Read-only answers grounded in published help articles and your account.
      </p>
      <div className="mt-6">
        {enabled ? (
          <CustomerAssistant />
        ) : (
          <div className="card p-6 text-sm text-slate-500">
            The customer assistant is not enabled for this installation. You can
            still contact the support team from the Tickets page.
          </div>
        )}
      </div>
    </div>
  );
}
