import "server-only";
import { db } from "@/lib/db";

export const SETTING_DEFAULTS: Record<string, string> = {
  company_name: "OpenHosting",
  company_url: "http://localhost:3000",
  currency: "USD",
  theme: "indigo",
  // days before expiry to generate the renewal invoice
  invoice_days_before: "7",
  // days after due date before a service is suspended
  suspend_days_after: "2",
  // days after suspension before a service is cancelled
  cancel_days_after: "14",
  tax_enabled: "false",
  registration_enabled: "true",
  require_email_verification: "false",
  // Cloudflare Turnstile captcha on the registration form (blank = off)
  turnstile_site_key: "",
  turnstile_secret: "",
  turnstile_on_checkout: "false",
  // ── Sign-in protection ──
  // failed sign-ins for one account before it is locked out (0 = off)
  login_max_attempts: "5",
  // failed sign-ins from one IP across all accounts (0 = off)
  login_ip_max_attempts: "20",
  // how long a lockout lasts, and the window failures are counted over
  login_lockout_minutes: "15",
  // staff (anyone with a role) must have 2FA on to reach the admin panel
  require_staff_2fa: "false",
  // ── AI support (needs an enabled AI extension with your own API key) ──
  // staff-reviewed reply drafts on tickets; nothing is ever sent automatically
  ai_reply_drafts: "false",
  // optional sign-off appended to drafts, e.g. "— The Acme support team"
  ai_reply_signature: "",
  // classify department/priority when a ticket is created
  ai_auto_triage: "false",
  // below this confidence the customer's own choices are left alone (0-1)
  ai_triage_min_confidence: "0.7",
  // ── Fraud prevention ──
  fraud_review_all: "false",
  // external risk score (0-99) at or above which orders go to manual review
  fraud_risk_threshold: "75",
  // max orders per IP per hour before review (0 = off)
  fraud_velocity_max: "5",
  fraud_require_verified_email: "false",
  fraud_block_disposable: "true",
  maxmind_account_id: "",
  maxmind_license_key: "",
  fraudlabs_api_key: "",
  // EU B2B reverse charge for validated VAT ids
  vat_reverse_charge: "false",
  company_country: "US",
  // ── Affiliate program ──
  affiliate_enabled: "true",
  affiliate_commission_type: "PERCENT",
  affiliate_commission_value: "10",
  // "true" = commission on every invoice, "false" = first invoice only
  affiliate_recurring: "false",
  affiliate_payout_threshold: "25",
  mail_from: "billing@example.com",
  smtp_host: "",
  smtp_port: "587",
  smtp_user: "",
  smtp_pass: "",
  smtp_secure: "false",
};

export async function getSetting(key: string): Promise<string> {
  const row = await db.setting.findUnique({ where: { key } });
  return row?.value ?? SETTING_DEFAULTS[key] ?? "";
}

export async function getSettings(
  keys: string[],
): Promise<Record<string, string>> {
  const rows = await db.setting.findMany({ where: { key: { in: keys } } });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return Object.fromEntries(
    keys.map((k) => [k, map[k] ?? SETTING_DEFAULTS[k] ?? ""]),
  );
}

const trimTrailingSlashes = (url: string) => url.replace(/\/+$/, "");

async function requestOrigin(): Promise<string | null> {
  try {
    // Imported lazily: standalone scripts pull this module in too, and they
    // have no Next request runtime.
    const { headers } = await import("next/headers");
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (!host) return null;
    const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
    return `${proto}://${host}`;
  } catch {
    return null; // no request in scope (cron tick, importers, seed)
  }
}

/**
 * Base URL for links the app shows or hands to a payment gateway.
 *
 * **Admin → Settings → Public URL** always wins. Until an operator sets it the
 * value is the `http://localhost:3000` placeholder, which is useless in a link,
 * so during a request we fall back to the address that request arrived on — a
 * fresh install shows its real hostname instead of localhost. Outside a request
 * there is nothing to fall back to and the setting is used as it stands.
 */
export async function publicUrl(): Promise<string> {
  const configured = trimTrailingSlashes(await getSetting("company_url"));
  if (configured && configured !== SETTING_DEFAULTS.company_url) return configured;
  return (await requestOrigin()) ?? configured ?? SETTING_DEFAULTS.company_url;
}

/**
 * Same, for links that get emailed — and deliberately never trusts the request.
 * A password-reset link goes to the account owner, not to whoever asked for it,
 * so it must not be steerable through a forged Host header.
 */
export async function publicUrlForEmail(): Promise<string> {
  const configured = trimTrailingSlashes(await getSetting("company_url"));
  return configured || SETTING_DEFAULTS.company_url;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}
