"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  createSession,
  createToken,
  consumeToken,
  destroySession,
  hashPassword,
  requireUser,
  verifyPassword,
} from "@/lib/auth";
import { verifyTotp, generateTotpSecret } from "@/lib/totp";
import {
  checkLoginBlocked,
  clearLoginFailures,
  clientIp,
  recordLoginFailure,
} from "@/lib/services/login-guard";
import { headers } from "next/headers";
import { getSetting, getSettings, publicUrlForEmail } from "@/lib/settings";
import { sendTemplate } from "@/lib/mail";
import { audit } from "@/lib/audit";

export type FormState = { error?: string; success?: string } | null;

const TWO_FA_COOKIE = "oh_2fa";

function lockedOutMessage(minutes: number): string {
  return `Too many failed sign-in attempts. Try again in ${minutes} minute${
    minutes === 1 ? "" : "s"
  }.`;
}

// ── Login ───────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function login(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter a valid email and password." };

  const email = parsed.data.email.toLowerCase();
  const ip = await clientIp();

  // Checked before the lookup, so an address that does not exist behaves the
  // same as one that does and the message gives nothing away.
  const blocked = await checkLoginBlocked(email, ip);
  if (blocked) {
    await audit("auth.login_blocked", { metadata: { email } });
    return { error: lockedOutMessage(blocked.retryAfterMinutes) };
  }

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(parsed.data.password, user.password))) {
    await recordLoginFailure(email, ip);
    await audit("auth.login_failed", { metadata: { email } });
    return { error: "Invalid email or password." };
  }

  if (user.totpEnabledAt) {
    const raw = await createToken(user.id, "TWO_FACTOR", 10);
    const cookieStore = await cookies();
    cookieStore.set(TWO_FA_COOKIE, raw, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600,
    });
    redirect("/two-factor");
  }

  await clearLoginFailures(email);
  await createSession(user.id);
  await audit("auth.login", { userId: user.id });
  redirect(user.roleId ? "/admin" : "/dashboard");
}

export async function verifyTwoFactor(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const code = String(formData.get("code") ?? "");
  const cookieStore = await cookies();
  const raw = cookieStore.get(TWO_FA_COOKIE)?.value;
  if (!raw) redirect("/login");

  const userId = await consumeToken(raw, "TWO_FACTOR");
  if (!userId) redirect("/login");

  const user = await db.user.findUnique({ where: { id: userId } });
  const ip = await clientIp();

  // Guessing a six-digit code is cheap, so the second step spends the same
  // budget as the password step.
  const reissue = async () => {
    const fresh = await createToken(userId, "TWO_FACTOR", 10);
    cookieStore.set(TWO_FA_COOKIE, fresh, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600,
    });
  };

  if (user) {
    const blocked = await checkLoginBlocked(user.email, ip);
    if (blocked) {
      await audit("auth.login_blocked", {
        userId: user.id,
        metadata: { step: "2fa" },
      });
      await reissue();
      return { error: lockedOutMessage(blocked.retryAfterMinutes) };
    }
  }

  if (!user?.totpSecret || !verifyTotp(user.totpSecret, code)) {
    if (user) await recordLoginFailure(user.email, ip);
    await audit("auth.login_failed", {
      userId: user?.id,
      metadata: { step: "2fa" },
    });
    // token is consumed; issue a fresh one so the user can retry
    await reissue();
    return { error: "Invalid code, try again." };
  }

  cookieStore.delete(TWO_FA_COOKIE);
  await clearLoginFailures(user.email);
  await createSession(user.id);
  await audit("auth.login_2fa", { userId: user.id });
  redirect(user.roleId ? "/admin" : "/dashboard");
}

// ── Registration ────────────────────────────────────────────────────────────

const registerSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

async function verifyTurnstile(formData: FormData): Promise<boolean> {
  const secret = await getSetting("turnstile_secret");
  if (!secret) return true; // captcha not configured
  const token = String(formData.get("cf-turnstile-response") ?? "");
  if (!token) return false;
  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    },
  );
  const data = await res.json().catch(() => null);
  return data?.success === true;
}

export async function register(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if ((await getSetting("registration_enabled")) !== "true") {
    return { error: "Registration is currently disabled." };
  }
  if (!(await verifyTurnstile(formData))) {
    return { error: "Captcha verification failed. Please try again." };
  }
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const email = parsed.data.email.toLowerCase();
  if (await db.user.findUnique({ where: { email } })) {
    return { error: "An account with this email already exists." };
  }
  {
    const { isRegistrationBlocked } = await import("@/lib/services/fraud");
    const hdrs = await headers();
    const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const blocked = await isRegistrationBlocked(email, ip);
    if (blocked) return { error: blocked };
  }
  const user = await db.user.create({
    data: {
      email,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      password: await hashPassword(parsed.data.password),
    },
  });
  await audit("auth.register", { userId: user.id });

  // affiliate referral attribution from the ?ref cookie
  {
    const { attributeReferral, REF_COOKIE } = await import(
      "@/lib/services/affiliates"
    );
    const cookieStore = await cookies();
    await attributeReferral(user.id, cookieStore.get(REF_COOKIE)?.value ?? null);
  }

  const settings = await getSettings(["company_name"]);
  const baseUrl = await publicUrlForEmail();
  await sendTemplate(user.email, "welcome", {
    name: user.firstName,
    company: settings.company_name,
    url: baseUrl,
  });
  if ((await getSetting("require_email_verification")) === "true") {
    const raw = await createToken(user.id, "EMAIL_VERIFICATION");
    await sendTemplate(user.email, "verify_email", {
      name: user.firstName,
      link: `${baseUrl}/verify-email?token=${raw}`,
    });
  } else {
    await db.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date() },
    });
  }

  await createSession(user.id);
  redirect("/dashboard");
}

// ── Logout ──────────────────────────────────────────────────────────────────

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}

// ── Password reset ──────────────────────────────────────────────────────────

export async function forgotPassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "").toLowerCase();
  const user = await db.user.findUnique({ where: { email } });
  if (user) {
    const raw = await createToken(user.id, "PASSWORD_RESET");
    const url = await publicUrlForEmail();
    await sendTemplate(user.email, "password_reset", {
      name: user.firstName,
      link: `${url}/reset-password?token=${raw}`,
    });
  }
  return { success: "If that email exists, a reset link has been sent." };
}

export async function resetPassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  const userId = await consumeToken(token, "PASSWORD_RESET");
  if (!userId) return { error: "This reset link is invalid or has expired." };
  await db.user.update({
    where: { id: userId },
    data: { password: await hashPassword(password) },
  });
  // revoke existing sessions
  await db.session.deleteMany({ where: { userId } });
  await audit("auth.password_reset", { userId });
  redirect("/login");
}

// ── Two-factor management (client area) ─────────────────────────────────────

export async function beginTwoFactorSetup(): Promise<void> {
  const user = await requireUser();
  const secret = generateTotpSecret();
  await db.user.update({
    where: { id: user.id },
    data: { totpSecret: secret, totpEnabledAt: null },
  });
  redirect("/dashboard/account/two-factor");
}

export async function confirmTwoFactor(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const code = String(formData.get("code") ?? "");
  if (!user.totpSecret || !verifyTotp(user.totpSecret, code)) {
    return { error: "Invalid code. Scan the QR code and try again." };
  }
  await db.user.update({
    where: { id: user.id },
    data: { totpEnabledAt: new Date() },
  });
  await audit("auth.2fa_enabled", { userId: user.id });
  return { success: "Two-factor authentication enabled." };
}

export async function disableTwoFactor(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (user.roleId && (await getSetting("require_staff_2fa")) === "true") {
    return {
      error:
        "Two-factor authentication is required for staff accounts and cannot be turned off.",
    };
  }
  const password = String(formData.get("password") ?? "");
  if (!(await verifyPassword(password, user.password))) {
    return { error: "Incorrect password." };
  }
  await db.user.update({
    where: { id: user.id },
    data: { totpSecret: null, totpEnabledAt: null },
  });
  await audit("auth.2fa_disabled", { userId: user.id });
  return { success: "Two-factor authentication disabled." };
}
