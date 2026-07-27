import "server-only";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";

/**
 * Sign-in throttling.
 *
 * Failed password and 2FA attempts are counted per account and per client
 * address. Once either budget is spent the account (or address) is refused for
 * `login_lockout_minutes`, which is also the window failures are counted over —
 * so a lockout always expires on its own.
 *
 * The check runs before the account is looked up, so an unknown address is
 * throttled exactly like a real one and the response never reveals which is
 * which. Attempts made while locked out are not recorded, so an attacker
 * cannot keep somebody else's account locked indefinitely.
 */

export type LoginBlock = { retryAfterMinutes: number };

export async function clientIp(): Promise<string | null> {
  const hdrs = await headers().catch(() => null);
  return hdrs?.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

async function limits() {
  const s = await getSettings([
    "login_max_attempts",
    "login_ip_max_attempts",
    "login_lockout_minutes",
  ]);
  return {
    perAccount: Math.max(0, Number(s.login_max_attempts) || 0),
    perIp: Math.max(0, Number(s.login_ip_max_attempts) || 0),
    minutes: Math.max(1, Number(s.login_lockout_minutes) || 15),
  };
}

/** Null when the attempt may proceed. */
export async function checkLoginBlocked(
  email: string,
  ip: string | null,
): Promise<LoginBlock | null> {
  const { perAccount, perIp, minutes } = await limits();
  if (perAccount === 0 && perIp === 0) return null;

  const since = new Date(Date.now() - minutes * 60_000);
  const newest = { createdAt: "desc" } as const;
  const [byAccount, byIp] = await Promise.all([
    perAccount > 0
      ? db.loginAttempt.findMany({
          where: { email: email.toLowerCase(), createdAt: { gte: since } },
          orderBy: newest,
          take: perAccount,
        })
      : [],
    perIp > 0 && ip
      ? db.loginAttempt.findMany({
          where: { ip, createdAt: { gte: since } },
          orderBy: newest,
          take: perIp,
        })
      : [],
  ]);

  // The most recent failure of whichever budget ran out sets the release time.
  let last: Date | null = null;
  if (perAccount > 0 && byAccount.length >= perAccount) last = byAccount[0].createdAt;
  if (perIp > 0 && byIp.length >= perIp) {
    const ipLast = byIp[0].createdAt;
    if (!last || ipLast > last) last = ipLast;
  }
  if (!last) return null;

  const remainingMs = last.getTime() + minutes * 60_000 - Date.now();
  if (remainingMs <= 0) return null;
  return { retryAfterMinutes: Math.max(1, Math.ceil(remainingMs / 60_000)) };
}

export async function recordLoginFailure(
  email: string,
  ip: string | null,
): Promise<void> {
  await db.loginAttempt.create({
    data: { email: email.toLowerCase(), ip },
  });
}

/** Called once a sign-in completes — the 2FA step included. */
export async function clearLoginFailures(email: string): Promise<void> {
  await db.loginAttempt.deleteMany({ where: { email: email.toLowerCase() } });
}

/** Housekeeping for the hourly cron: nothing older than a day is of interest. */
export async function pruneLoginAttempts(): Promise<number> {
  const { count } = await db.loginAttempt.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60_000) } },
  });
  return count;
}
