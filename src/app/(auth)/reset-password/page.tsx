import { resetPassword } from "@/lib/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";

export const metadata = { title: "Set new password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Set a new password</h1>
      <p className="mb-6 text-sm text-slate-500">
        Choose a strong password for your account.
      </p>
      <ActionForm action={resetPassword}>
        <input type="hidden" name="token" value={token ?? ""} />
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
        <SubmitButton>Update password</SubmitButton>
      </ActionForm>
    </div>
  );
}
