import "server-only";
import { db } from "@/lib/db";

export const SETTING_DEFAULTS: Record<string, string> = {
  company_name: "OpenHosting",
  company_url: "http://localhost:3000",
  currency: "USD",
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
