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

export async function setSetting(key: string, value: string): Promise<void> {
  await db.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}
