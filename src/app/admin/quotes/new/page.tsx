import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { createQuote } from "@/lib/actions/quotes";
import { ActionForm, SubmitButton } from "@/components/forms";
import { QuoteLineEditor } from "./line-editor";

export const metadata = { title: "New quote" };

export default async function NewQuotePage() {
  await requireAdmin("quotes");
  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">New quote</h1>
      <div className="card mt-6 p-6">
        <ActionForm action={createQuote}>
          <div>
            <label className="label">Customer</label>
            <select name="userId" required className="input">
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} ({u.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Line items</label>
            <QuoteLineEditor />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Valid until (optional)</label>
              <input name="validUntil" type="date" className="input" />
            </div>
          </div>
          <div>
            <label className="label">Notes (optional)</label>
            <textarea name="notes" rows={3} className="input" />
          </div>
          <SubmitButton className="btn-primary">Create quote</SubmitButton>
        </ActionForm>
      </div>
    </div>
  );
}
