import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { sendMassMail } from "@/lib/actions/mass-mail";
import { ActionForm, SubmitButton } from "@/components/forms";

export const metadata = { title: "Mass mail" };

export default async function AdminMassMailPage() {
  await requireAdmin("mass-mail");
  const [history, counts] = await Promise.all([
    db.massMail.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    Promise.all([
      db.user.count(),
      db.user.count({ where: { services: { some: { status: "ACTIVE" } } } }),
      db.user.count({ where: { services: { none: {} } } }),
    ]),
  ]);
  const [all, active, none] = counts;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">Mass mail</h1>
      <p className="mt-1 text-sm text-slate-500">
        Send an announcement to a customer segment. Use <code>{"{{name}}"}</code>{" "}
        to personalize the greeting. Delivery uses your SMTP settings.
      </p>

      <div className="card mt-6 p-6">
        <ActionForm action={sendMassMail}>
          <div>
            <label className="label">Audience</label>
            <select name="audience" className="input">
              <option value="all">All customers ({all})</option>
              <option value="active_service">
                With an active service ({active})
              </option>
              <option value="no_service">No services ({none})</option>
            </select>
          </div>
          <div>
            <label className="label">Subject</label>
            <input name="subject" required className="input" />
          </div>
          <div>
            <label className="label">Body (HTML)</label>
            <textarea name="body" rows={8} required className="input font-mono text-xs" />
          </div>
          <SubmitButton className="btn-primary">Send</SubmitButton>
        </ActionForm>
      </div>

      <div className="card mt-8">
        <h2 className="px-5 py-4 font-semibold">History</h2>
        <table className="table-base">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Audience</th>
              <th>Sent</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {history.map((mail) => (
              <tr key={mail.id}>
                <td className="font-medium">{mail.subject}</td>
                <td className="text-slate-500">{mail.audience.replace("_", " ")}</td>
                <td>{mail.sentCount}</td>
                <td>{formatDateTime(mail.createdAt)}</td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-slate-400">
                  No campaigns sent yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
