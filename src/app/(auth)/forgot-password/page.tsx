import Link from "next/link";
import { forgotPassword } from "@/lib/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Reset your password</h1>
      <p className="mb-6 text-sm text-slate-500">
        We&apos;ll email you a link to set a new password.
      </p>
      <ActionForm action={forgotPassword}>
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="input"
          />
        </div>
        <SubmitButton>Send reset link</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-slate-500">
        <Link href="/login" className="text-brand-600 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
