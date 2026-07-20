import "server-only";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import type { User } from "@/generated/prisma/client";

// Fraud service: every pre-order defense lives here — ban lists, disposable
// email blocking, velocity limits, third-party risk scoring (MaxMind
// minFraud / FraudLabs Pro) and the review-queue verdict.

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com",
  "temp-mail.org", "throwawaymail.com", "yopmail.com", "getnada.com",
  "trashmail.com", "sharklasers.com", "dispostable.com", "maildrop.cc",
  "fakeinbox.com", "mintemail.com", "mytemp.email", "spamgourmet.com",
  "mail-temp.com", "tempinbox.com", "emailondeck.com", "moakt.com",
  "tmpmail.net", "burnermail.io", "mailsac.com", "inboxkitten.com",
  "33mail.com", "mohmal.com", "tempr.email", "discard.email",
]);

export type FraudVerdict = {
  action: "allow" | "review" | "block";
  score: number | null;
  notes: string[];
};

async function banRuleHit(
  email: string,
  ip: string | null,
  country: string | null,
): Promise<string | null> {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  const rules = await db.banRule.findMany();
  for (const rule of rules) {
    const value = rule.value.toLowerCase();
    if (rule.type === "EMAIL" && value === email.toLowerCase()) {
      return `banned email (${rule.reason ?? "no reason"})`;
    }
    if (rule.type === "EMAIL_DOMAIN" && value === domain) {
      return `banned email domain (${rule.reason ?? "no reason"})`;
    }
    if (rule.type === "IP" && ip && value === ip.toLowerCase()) {
      return `banned IP (${rule.reason ?? "no reason"})`;
    }
    if (
      rule.type === "COUNTRY" &&
      country &&
      value === country.toLowerCase()
    ) {
      return `banned country (${rule.reason ?? "no reason"})`;
    }
  }
  return null;
}

// Registration-time check (email rules only — cheap and early).
export async function isRegistrationBlocked(
  email: string,
  ip: string | null,
): Promise<string | null> {
  const settings = await getSettings(["fraud_block_disposable"]);
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (settings.fraud_block_disposable === "true" && DISPOSABLE_DOMAINS.has(domain)) {
    return "Disposable email addresses are not accepted.";
  }
  const hit = await banRuleHit(email, ip, null);
  return hit ? "Registration is not available for this account." : null;
}

async function externalRiskScore(
  user: User,
  ip: string | null,
): Promise<{ score: number; source: string } | null> {
  const s = await getSettings([
    "maxmind_account_id",
    "maxmind_license_key",
    "fraudlabs_api_key",
  ]);
  const scores: Array<{ score: number; source: string }> = [];

  if (s.maxmind_account_id && s.maxmind_license_key && ip) {
    try {
      const res = await fetch("https://minfraud.maxmind.com/minfraud/v2.0/score", {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${s.maxmind_account_id}:${s.maxmind_license_key}`).toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          device: { ip_address: ip },
          email: { address: user.email },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        // minFraud risk_score is 0.01–99 (probability of fraud in %)
        scores.push({ score: Math.round(data.risk_score ?? 0), source: "minFraud" });
      }
    } catch {
      // scoring is best-effort; never fail checkout on a vendor outage
    }
  }

  if (s.fraudlabs_api_key && ip) {
    try {
      const query = new URLSearchParams({
        key: s.fraudlabs_api_key,
        ip,
        email: user.email,
        format: "json",
      });
      const res = await fetch(`https://api.fraudlabspro.com/v2/order/screen?${query}`);
      if (res.ok) {
        const data = await res.json();
        scores.push({
          score: Math.round(Number(data.fraudlabspro_score ?? 0)),
          source: "FraudLabs Pro",
        });
      }
    } catch {
      // best-effort
    }
  }

  if (scores.length === 0) return null;
  return scores.reduce((a, b) => (b.score > a.score ? b : a));
}

// The main pre-checkout assessment.
export async function assessOrder(
  user: User,
  ip: string | null,
): Promise<FraudVerdict> {
  const notes: string[] = [];
  const settings = await getSettings([
    "fraud_review_all",
    "fraud_risk_threshold",
    "fraud_velocity_max",
    "fraud_require_verified_email",
    "fraud_block_disposable",
  ]);

  // hard blocks first
  const banned = await banRuleHit(user.email, ip, user.country);
  if (banned) return { action: "block", score: null, notes: [banned] };

  const domain = user.email.split("@")[1]?.toLowerCase() ?? "";
  if (settings.fraud_block_disposable === "true" && DISPOSABLE_DOMAINS.has(domain)) {
    return { action: "block", score: null, notes: ["disposable email domain"] };
  }

  if (
    settings.fraud_require_verified_email === "true" &&
    !user.emailVerifiedAt
  ) {
    return {
      action: "block",
      score: null,
      notes: ["email not verified — verification required before ordering"],
    };
  }

  // velocity: orders from this IP in the last hour
  const velocityMax = Number(settings.fraud_velocity_max);
  if (ip && velocityMax > 0) {
    const recent = await db.order.count({
      where: { ip, createdAt: { gte: new Date(Date.now() - 3_600_000) } },
    });
    if (recent >= velocityMax) {
      notes.push(`velocity: ${recent} orders from ${ip} in the last hour`);
      return { action: "review", score: null, notes };
    }
  }

  // third-party risk scoring
  let score: number | null = null;
  const external = await externalRiskScore(user, ip);
  if (external) {
    score = external.score;
    notes.push(`${external.source} score ${external.score}`);
    if (external.score >= Number(settings.fraud_risk_threshold)) {
      return { action: "review", score, notes };
    }
  }

  if (settings.fraud_review_all === "true") {
    notes.push("manual review required for all orders (setting)");
    return { action: "review", score, notes };
  }
  return { action: "allow", score, notes };
}

// Cloudflare Turnstile verification (shared by register + checkout forms).
export async function verifyCaptcha(formData: FormData): Promise<boolean> {
  const settings = await getSettings(["turnstile_secret"]);
  if (!settings.turnstile_secret) return true;
  const token = String(formData.get("cf-turnstile-response") ?? "");
  if (!token) return false;
  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: settings.turnstile_secret,
          response: token,
        }),
      },
    );
    const data = await res.json().catch(() => null);
    return data?.success === true;
  } catch {
    return false;
  }
}

// ── EU VAT (VIES) ───────────────────────────────────────────────────────────

const EU_COUNTRIES = new Set([
  "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE",
  "IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE",
]);

export function isEuCountry(country: string | null): boolean {
  return Boolean(country && EU_COUNTRIES.has(country.toUpperCase()));
}

// Validates a VAT number against the EU VIES service.
export async function validateVatId(
  country: string,
  vatId: string,
): Promise<boolean> {
  const ms = country.toUpperCase() === "GR" ? "EL" : country.toUpperCase();
  const number = vatId.replace(/^[A-Za-z]{2}/, "").replace(/[^0-9A-Za-z+*.]/g, "");
  try {
    const res = await fetch(
      `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${ms}/vat/${encodeURIComponent(number)}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) return false;
    const data = await res.json();
    return data?.isValid === true;
  } catch {
    return false;
  }
}

// B2B reverse charge: valid EU VAT id + setting enabled = no tax charged.
export async function isTaxExempt(user: User): Promise<boolean> {
  const settings = await getSettings(["vat_reverse_charge", "company_country"]);
  if (settings.vat_reverse_charge !== "true") return false;
  if (!user.vatId || !user.vatValidatedAt || !isEuCountry(user.country)) {
    return false;
  }
  // no reverse charge for domestic sales
  return user.country?.toUpperCase() !== settings.company_country.toUpperCase();
}
