import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  GATEWAY_DRIVERS,
  SERVER_DRIVERS,
  syncExtensions,
} from "@/lib/extensions/registry";
import { saveExtension } from "@/lib/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import type { ConfigField } from "@/lib/extensions/types";

export const metadata = { title: "Extensions" };

function Field({
  field,
  value,
}: {
  field: ConfigField;
  value: string;
}) {
  if (field.type === "checkbox") {
    return (
      <div className="flex items-center gap-2">
        <input
          id={`cfg_${field.key}`}
          name={`cfg_${field.key}`}
          type="checkbox"
          value="true"
          defaultChecked={value === "true"}
        />
        <label htmlFor={`cfg_${field.key}`} className="text-sm">
          {field.label}
        </label>
      </div>
    );
  }
  return (
    <div>
      <label className="label" htmlFor={`cfg_${field.key}`}>
        {field.label}
      </label>
      <input
        id={`cfg_${field.key}`}
        name={`cfg_${field.key}`}
        type={field.type === "password" ? "password" : "text"}
        defaultValue={value}
        required={field.required}
        className="input"
      />
      {field.help && <p className="mt-1 text-xs text-slate-400">{field.help}</p>}
    </div>
  );
}

export default async function AdminExtensionsPage() {
  await requireAdmin("extensions");
  await syncExtensions();
  const extensions = await db.extension.findMany({ orderBy: { name: "asc" } });
  const drivers = [...GATEWAY_DRIVERS, ...SERVER_DRIVERS];

  return (
    <div>
      <h1 className="text-2xl font-bold">Extensions</h1>
      <p className="mt-1 text-sm text-slate-500">
        Payment gateways and server-provisioning integrations. Enable and
        configure the ones you use.
      </p>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {extensions.map((ext) => {
          const driver = drivers.find((d) => d.slug === ext.slug);
          if (!driver) return null;
          const config = (ext.config ?? {}) as Record<string, string>;
          return (
            <div key={ext.id} className="card p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">{ext.name}</h2>
                  <p className="text-xs text-slate-400 uppercase">
                    {ext.type === "GATEWAY" ? "Payment gateway" : "Server integration"}
                  </p>
                </div>
                <span
                  className={`badge ${ext.enabled ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}
                >
                  {ext.enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
              <ActionForm action={saveExtension}>
                <input type="hidden" name="id" value={ext.id} />
                {driver.configFields.map((field) => (
                  <Field
                    key={field.key}
                    field={field}
                    value={config[field.key] ?? ""}
                  />
                ))}
                <div className="flex items-center gap-2">
                  <input
                    id={`enabled_${ext.id}`}
                    name="enabled"
                    type="checkbox"
                    defaultChecked={ext.enabled}
                  />
                  <label htmlFor={`enabled_${ext.id}`} className="text-sm">
                    Enabled
                  </label>
                </div>
                <SubmitButton className="btn-primary">Save</SubmitButton>
              </ActionForm>
            </div>
          );
        })}
      </div>
    </div>
  );
}
