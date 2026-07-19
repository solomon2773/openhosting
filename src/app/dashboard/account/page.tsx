import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  beginTwoFactorSetup,
  disableTwoFactor,
} from "@/lib/actions/auth";
import {
  changePassword,
  saveNotificationPreferences,
  updateProfile,
} from "@/lib/actions/client";
import { NOTIFICATION_TYPES } from "@/lib/services/notifications";
import { ActionForm, SubmitButton } from "@/components/forms";

export const metadata = { title: "Account" };

const PROFILE_FIELDS = [
  { name: "firstName", label: "First name", required: true },
  { name: "lastName", label: "Last name", required: true },
  { name: "companyName", label: "Company (optional)" },
  { name: "phone", label: "Phone" },
  { name: "address", label: "Address" },
  { name: "city", label: "City" },
  { name: "state", label: "State / province" },
  { name: "zip", label: "Postal code" },
  { name: "country", label: "Country (ISO code, e.g. US)" },
] as const;

export default async function AccountPage() {
  const user = await requireUser();
  const prefs = await db.notificationPreference.findMany({
    where: { userId: user.id },
  });
  const prefFor = (type: string) =>
    prefs.find((p) => p.type === type) ?? { email: true, inApp: true };

  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="text-2xl font-bold">Account settings</h1>

      <div className="card p-6">
        <h2 className="mb-4 font-semibold">Profile</h2>
        <ActionForm action={updateProfile}>
          <div className="grid gap-4 sm:grid-cols-2">
            {PROFILE_FIELDS.map((field) => (
              <div key={field.name}>
                <label className="label" htmlFor={field.name}>
                  {field.label}
                </label>
                <input
                  id={field.name}
                  name={field.name}
                  defaultValue={user[field.name] ?? ""}
                  required={"required" in field && field.required}
                  className="input"
                />
              </div>
            ))}
          </div>
          <p className="text-sm text-slate-500">Email: {user.email}</p>
          <SubmitButton className="btn-primary">Save profile</SubmitButton>
        </ActionForm>
      </div>

      <div className="card p-6">
        <h2 className="mb-4 font-semibold">Change password</h2>
        <ActionForm action={changePassword}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="current">
                Current password
              </label>
              <input
                id="current"
                name="current"
                type="password"
                required
                className="input"
                autoComplete="current-password"
              />
            </div>
            <div>
              <label className="label" htmlFor="password">
                New password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                className="input"
                autoComplete="new-password"
              />
            </div>
          </div>
          <SubmitButton className="btn-primary">Update password</SubmitButton>
        </ActionForm>
      </div>

      <div className="card p-6">
        <h2 className="mb-4 font-semibold">Notifications</h2>
        <ActionForm action={saveNotificationPreferences}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase">
                <th className="pb-2">Event</th>
                <th className="pb-2 text-center">Email</th>
                <th className="pb-2 text-center">In-app</th>
              </tr>
            </thead>
            <tbody>
              {NOTIFICATION_TYPES.map(({ type, label }) => {
                const pref = prefFor(type);
                return (
                  <tr key={type} className="border-t border-slate-100">
                    <td className="py-2">{label}</td>
                    <td className="py-2 text-center">
                      <input
                        type="checkbox"
                        name={`email_${type}`}
                        defaultChecked={pref.email}
                      />
                    </td>
                    <td className="py-2 text-center">
                      <input
                        type="checkbox"
                        name={`inapp_${type}`}
                        defaultChecked={pref.inApp}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <SubmitButton className="btn-primary">Save preferences</SubmitButton>
        </ActionForm>
      </div>

      <div className="card p-6">
        <h2 className="mb-2 font-semibold">Two-factor authentication</h2>
        {user.totpEnabledAt ? (
          <div>
            <p className="text-sm text-green-700">
              Two-factor authentication is <strong>enabled</strong> on your
              account.
            </p>
            <ActionForm action={disableTwoFactor} className="mt-4 space-y-3">
              <div className="max-w-xs">
                <label className="label" htmlFor="disablePassword">
                  Confirm password to disable
                </label>
                <input
                  id="disablePassword"
                  name="password"
                  type="password"
                  required
                  className="input"
                />
              </div>
              <SubmitButton className="btn-danger">Disable 2FA</SubmitButton>
            </ActionForm>
          </div>
        ) : (
          <div>
            <p className="text-sm text-slate-500">
              Protect your account with a time-based one-time password from an
              authenticator app (Google Authenticator, Aegis, 1Password…).
            </p>
            <form action={beginTwoFactorSetup} className="mt-4">
              <SubmitButton className="btn-primary">
                Set up two-factor authentication
              </SubmitButton>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
