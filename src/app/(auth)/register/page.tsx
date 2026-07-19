import Link from "next/link";
import { register } from "@/lib/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";

export const metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Create your account</h1>
      <p className="mb-6 text-sm text-slate-500">
        Order services and manage billing in one place.
      </p>
      <ActionForm action={register}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="firstName">
              First name
            </label>
            <input
              id="firstName"
              name="firstName"
              required
              className="input"
              autoComplete="given-name"
            />
          </div>
          <div>
            <label className="label" htmlFor="lastName">
              Last name
            </label>
            <input
              id="lastName"
              name="lastName"
              required
              className="input"
              autoComplete="family-name"
            />
          </div>
        </div>
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
            autoComplete="email"
          />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Password
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
          <p className="mt-1 text-xs text-slate-400">At least 8 characters.</p>
        </div>
        <SubmitButton>Create account</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
