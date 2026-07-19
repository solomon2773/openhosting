import Link from "next/link";
import { login } from "@/lib/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { getT } from "@/lib/i18n";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const t = await getT();
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">{t("auth.welcomeBack")}</h1>
      <p className="mb-6 text-sm text-slate-500">{t("auth.signInSubtitle")}</p>
      <ActionForm action={login}>
        <div>
          <label className="label" htmlFor="email">
            {t("auth.email")}
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
              {t("auth.password")}
            </label>
            <Link
              href="/forgot-password"
              className="text-sm text-brand-600 hover:underline"
            >
              {t("auth.forgotPassword")}
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
        <SubmitButton>{t("auth.signIn")}</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-slate-500">
        {t("auth.newHere")}{" "}
        <Link href="/register" className="text-brand-600 hover:underline">
          {t("auth.createAccount")}
        </Link>
      </p>
    </div>
  );
}
