import Link from "next/link";
import { login } from "@/lib/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Welcome back</h1>
      <p className="mb-6 text-sm text-slate-500">
        Sign in to manage your services.
      </p>
      <ActionForm action={login}>
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="input"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="label mb-0" htmlFor="password">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-sm text-brand-600 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="input"
          />
        </div>
        <SubmitButton>Sign in</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-slate-500">
        New here?{" "}
        <Link href="/register" className="text-brand-600 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
