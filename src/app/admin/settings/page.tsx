import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { saveSettings } from "@/lib/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms";

export const metadata = { title: "Settings" };

const SECTIONS: Array<{
  heading: string;
  fields: Array<{
    key: string;
    label: string;
    type?: "text" | "password" | "checkbox" | "number";
    help?: string;
  }>;
}> = [
  {
    heading: "General",
    fields: [
      { key: "company_name", label: "Company name" },
      { key: "company_url", label: "Public URL", help: "Used in emails and payment redirects." },
      { key: "currency", label: "Currency (ISO code)", help: "e.g. USD, EUR" },
      { key: "registration_enabled", label: "Allow new registrations", type: "checkbox" },
      { key: "require_email_verification", label: "Require email verification", type: "checkbox" },
    ],
  },
  {
    heading: "Billing automation",
    fields: [
      { key: "invoice_days_before", label: "Generate renewal invoices (days before due)", type: "number" },
      { key: "suspend_days_after", label: "Suspend services (days after due)", type: "number" },
      { key: "cancel_days_after", label: "Terminate services (days after suspension)", type: "number" },
      { key: "tax_enabled", label: "Charge tax", type: "checkbox" },
    ],
  },
  {
    heading: "Email (SMTP)",
    fields: [
      { key: "mail_from", label: "From address" },
      { key: "smtp_host", label: "SMTP host" },
      { key: "smtp_port", label: "SMTP port", type: "number" },
      { key: "smtp_user", label: "SMTP username" },
      { key: "smtp_pass", label: "SMTP password", type: "password" },
      { key: "smtp_secure", label: "Use TLS (implicit)", type: "checkbox" },
    ],
  },
];

export default async function AdminSettingsPage() {
  await requireAdmin("settings");
  const keys = SECTIONS.flatMap((s) => s.fields.map((f) => f.key));
  const values = await getSettings(keys);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">Settings</h1>
      <ActionForm action={saveSettings} className="mt-6 space-y-8">
        {SECTIONS.map((section) => (
          <div key={section.heading} className="card p-6">
            <h2 className="mb-4 font-semibold">{section.heading}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {section.fields.map((field) =>
                field.type === "checkbox" ? (
                  <div key={field.key} className="flex items-center gap-2 pt-6">
                    {/* hidden false ensures unchecked boxes still submit */}
                    <input type="hidden" name={field.key} value="false" />
                    <input
                      id={field.key}
                      name={field.key}
                      type="checkbox"
                      value="true"
                      defaultChecked={values[field.key] === "true"}
                    />
                    <label htmlFor={field.key} className="text-sm">
                      {field.label}
                    </label>
                  </div>
                ) : (
                  <div key={field.key}>
                    <label className="label" htmlFor={field.key}>
                      {field.label}
                    </label>
                    <input
                      id={field.key}
                      name={field.key}
                      type={field.type ?? "text"}
                      defaultValue={values[field.key]}
                      className="input"
                    />
                    {field.help && (
                      <p className="mt-1 text-xs text-slate-400">{field.help}</p>
                    )}
                  </div>
                ),
              )}
            </div>
          </div>
        ))}
        <SubmitButton className="btn-primary">Save settings</SubmitButton>
      </ActionForm>
    </div>
  );
}
