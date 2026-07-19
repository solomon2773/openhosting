import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes, createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

const SESSION_COOKIE = "oh_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

export type SessionUser = Prisma.UserGetPayload<{ include: { role: true } }>;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string): Promise<void> {
  const hdrs = await headers();
  const session = await db.session.create({
    data: {
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      ip: hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: hdrs.get("user-agent"),
    },
  });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const id = cookieStore.get(SESSION_COOKIE)?.value;
  if (id) await db.session.deleteMany({ where: { id } });
  cookieStore.delete(SESSION_COOKIE);
}

export const getUser = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies();
  const id = cookieStore.get(SESSION_COOKIE)?.value;
  if (!id) return null;
  const session = await db.session.findUnique({
    where: { id },
    include: { user: { include: { role: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

export function hasPermission(user: SessionUser, permission: string): boolean {
  if (!user.role) return false;
  const perms = user.role.permissions as string[];
  return perms.includes("*") || perms.includes(permission);
}

export async function requireAdmin(permission = "admin"): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.role || !hasPermission(user, permission)) redirect("/dashboard");
  return user;
}

// ── One-time tokens (email verification / password reset) ──────────────────

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function createToken(
  userId: string,
  type: "EMAIL_VERIFICATION" | "PASSWORD_RESET" | "TWO_FACTOR",
  ttlMinutes = 60,
): Promise<string> {
  const raw = randomBytes(32).toString("hex");
  await db.verificationToken.deleteMany({ where: { userId, type } });
  await db.verificationToken.create({
    data: {
      token: sha256(raw),
      type,
      userId,
      expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
    },
  });
  return raw;
}

export async function consumeToken(
  raw: string,
  type: "EMAIL_VERIFICATION" | "PASSWORD_RESET" | "TWO_FACTOR",
): Promise<string | null> {
  const record = await db.verificationToken.findUnique({
    where: { token: sha256(raw) },
  });
  if (!record || record.type !== type || record.expiresAt < new Date()) {
    return null;
  }
  await db.verificationToken.delete({ where: { id: record.id } });
  return record.userId;
}
