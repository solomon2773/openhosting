import { verifyTwoFactor } from "@/lib/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";

export const metadata = { title: "Two-factor authentication" };

export default function TwoFactorPage() {
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Two-factor authentication</h1>
      <p className="mb-6 text-sm text-slate-500">
        Enter the 6-digit code from your authenticator app.
      </p>
      <ActionForm action={verifyTwoFactor}>
        <input
          name="code"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          required
          autoFocus
          className="input text-center text-2xl tracking-[0.5em]"
          placeholder="000000"
        />
        <SubmitButton>Verify</SubmitButton>
      </ActionForm>
    </div>
  );
}
