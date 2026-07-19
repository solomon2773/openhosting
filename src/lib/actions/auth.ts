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
import { getSetting, getSettings } from "@/lib/settings";
import { sendTemplate } from "@/lib/mail";
import { audit } from "@/lib/audit";

export type FormState = { error?: string; success?: string } | null;

const TWO_FA_COOKIE = "oh_2fa";

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

  const user = await db.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });
  if (!user || !(await verifyPassword(parsed.data.password, user.password))) {
    await audit("auth.login_failed", { metadata: { email: parsed.data.email } });
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
  if (!user?.totpSecret || !verifyTotp(user.totpSecret, code)) {
    // token is consumed; issue a fresh one so the user can retry
    const fresh = await createToken(userId, "TWO_FACTOR", 10);
    cookieStore.set(TWO_FA_COOKIE, fresh, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600,
    });
    return { error: "Invalid code, try again." };
  }

  cookieStore.delete(TWO_FA_COOKIE);
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

export async function register(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if ((await getSetting("registration_enabled")) !== "true") {
    return { error: "Registration is currently disabled." };
  }
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const email = parsed.data.email.toLowerCase();
  if (await db.user.findUnique({ where: { email } })) {
    return { error: "An account with this email already exists." };
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

  const settings = await getSettings(["company_name", "company_url"]);
  await sendTemplate(user.email, "welcome", {
    name: user.firstName,
    company: settings.company_name,
    url: settings.company_url,
  });
  if ((await getSetting("require_email_verification")) === "true") {
    const raw = await createToken(user.id, "EMAIL_VERIFICATION");
    await sendTemplate(user.email, "verify_email", {
      name: user.firstName,
      link: `${settings.company_url}/verify-email?token=${raw}`,
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
    const url = await getSetting("company_url");
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
