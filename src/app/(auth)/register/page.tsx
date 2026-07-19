import Link from "next/link";
import Script from "next/script";
import { register } from "@/lib/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { getT } from "@/lib/i18n";
import { getSetting } from "@/lib/settings";

export const metadata = { title: "Create account" };

export default async function RegisterPage() {
  const [t, turnstileSiteKey] = await Promise.all([
    getT(),
    getSetting("turnstile_site_key"),
  ]);
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">{t("auth.registerTitle")}</h1>
      <p className="mb-6 text-sm text-slate-500">
        {t("auth.registerSubtitle")}
      </p>
      <ActionForm action={register}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="firstName">
              {t("auth.firstName")}
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
              {t("auth.lastName")}
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
            {t("auth.email")}
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
            {t("auth.password")}
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
          <p className="mt-1 text-xs text-slate-400">
            {t("auth.passwordHint")}
          </p>
        </div>
        {turnstileSiteKey && (
          <>
            <div className="cf-turnstile" data-sitekey={turnstileSiteKey} />
            <Script
              src="https://challenges.cloudflare.com/turnstile/api.js"
              strategy="afterInteractive"
            />
          </>
        )}
        <SubmitButton>{t("auth.createAccount")}</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-slate-500">
        {t("auth.haveAccount")}{" "}
        <Link href="/login" className="text-brand-600 hover:underline">
          {t("auth.signIn")}
        </Link>
      </p>
    </div>
  );
}
