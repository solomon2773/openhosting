import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteContact, saveContact } from "@/lib/actions/contacts";
import { ActionForm, SubmitButton } from "@/components/forms";

export const metadata = { title: "Contacts / sub-accounts" };

const PERMISSIONS = [
  { key: "invoices", label: "View invoices" },
  { key: "tickets", label: "Manage tickets" },
  { key: "services", label: "View services" },
  { key: "manage", label: "Manage account" },
];

export default async function ContactsPage() {
  const user = await requireUser();
  const contacts = await db.contact.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">Contacts &amp; sub-accounts</h1>
      <p className="mt-1 text-sm text-slate-500">
        Add additional contacts to your account. Give them a password to let
        them log in with scoped access, or leave it blank for a
        notification-only contact.
      </p>

      <div className="card mt-6 divide-y divide-slate-100">
        {contacts.map((contact) => {
          const perms = (contact.permissions as string[]) ?? [];
          return (
            <div key={contact.id} className="flex items-start justify-between p-5">
              <div>
                <p className="font-medium">
                  {contact.firstName} {contact.lastName}
                  {contact.password && (
                    <span className="badge ml-2 bg-brand-100 text-brand-700">
                      can log in
                    </span>
                  )}
                </p>
                <p className="text-sm text-slate-500">{contact.email}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {perms.length ? perms.join(", ") : "no permissions"}
                </p>
              </div>
              <form action={deleteContact}>
                <input type="hidden" name="id" value={contact.id} />
                <button type="submit" className="text-sm text-red-600 hover:underline">
                  Remove
                </button>
              </form>
            </div>
          );
        })}
        {contacts.length === 0 && (
          <p className="p-8 text-center text-sm text-slate-400">
            No additional contacts yet.
          </p>
        )}
      </div>

      <div className="card mt-6 p-6">
        <h2 className="mb-4 font-semibold">Add a contact</h2>
        <ActionForm action={saveContact}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">First name</label>
              <input name="firstName" required className="input" />
            </div>
            <div>
              <label className="label">Last name</label>
              <input name="lastName" required className="input" />
            </div>
            <div>
              <label className="label">Email</label>
              <input name="email" type="email" required className="input" />
            </div>
            <div>
              <label className="label">Password (optional — enables login)</label>
              <input name="password" type="password" className="input" autoComplete="new-password" />
            </div>
          </div>
          <fieldset>
            <legend className="label">Permissions</legend>
            <div className="grid grid-cols-2 gap-1">
              {PERMISSIONS.map((p) => (
                <label key={p.key} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name={`perm_${p.key}`} />
                  {p.label}
                </label>
              ))}
            </div>
          </fieldset>
          <SubmitButton className="btn-primary">Add contact</SubmitButton>
        </ActionForm>
      </div>
    </div>
  );
}
