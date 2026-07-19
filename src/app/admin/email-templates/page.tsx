import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEFAULT_EMAIL_TEMPLATES } from "@/lib/mail";
import { saveEmailTemplate } from "@/lib/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms";

export const metadata = { title: "Email templates" };

export default async function AdminEmailTemplatesPage() {
  await requireAdmin("settings");
  // ensure defaults exist
  for (const template of DEFAULT_EMAIL_TEMPLATES) {
    await db.emailTemplate.upsert({
      where: { key: template.key },
      update: {},
      create: template,
    });
  }
  const templates = await db.emailTemplate.findMany({ orderBy: { key: "asc" } });

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">Email templates</h1>
      <p className="mt-1 text-sm text-slate-500">
        Placeholders like <code>{"{{name}}"}</code>, <code>{"{{invoice}}"}</code>,{" "}
        <code>{"{{link}}"}</code> are replaced when the email is sent.
      </p>
      <div className="mt-6 space-y-4">
        {templates.map((template) => (
          <details key={template.key} className="card p-5">
            <summary className="cursor-pointer font-medium">
              {template.key}
              {!template.enabled && (
                <span className="badge ml-2 bg-slate-100 text-slate-500">
                  disabled
                </span>
              )}
            </summary>
            <ActionForm action={saveEmailTemplate} className="mt-4 space-y-3">
              <input type="hidden" name="key" value={template.key} />
              <div>
                <label className="label">Subject</label>
                <input
                  name="subject"
                  defaultValue={template.subject}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Body (HTML)</label>
                <textarea
                  name="body"
                  rows={5}
                  defaultValue={template.body}
                  className="input font-mono text-xs"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id={`enabled_${template.key}`}
                  name="enabled"
                  type="checkbox"
                  defaultChecked={template.enabled}
                />
                <label htmlFor={`enabled_${template.key}`} className="text-sm">
                  Enabled
                </label>
              </div>
              <SubmitButton className="btn-primary">Save template</SubmitButton>
            </ActionForm>
          </details>
        ))}
      </div>
    </div>
  );
}
