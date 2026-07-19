import "server-only";
import type { User } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { sendTemplate } from "@/lib/mail";

// Notification service: one entry point that fans out to the in-app feed
// and templated email, honoring per-user channel preferences.

export const NOTIFICATION_TYPES = [
  { type: "invoice_created", label: "New invoice issued" },
  { type: "invoice_paid", label: "Payment received" },
  { type: "service_activated", label: "Service activated" },
  { type: "service_suspended", label: "Service suspended" },
  { type: "ticket_reply", label: "Support ticket replies" },
] as const;

async function preferenceFor(userId: string, type: string) {
  const pref = await db.notificationPreference.findUnique({
    where: { userId_type: { userId, type } },
  });
  return { email: pref?.email ?? true, inApp: pref?.inApp ?? true };
}

export async function notifyUser(
  user: Pick<User, "id" | "email" | "firstName">,
  type: string,
  opts: {
    title: string;
    body?: string;
    link?: string;
    // email template key + vars; omitted = in-app only
    templateKey?: string;
    templateVars?: Record<string, string>;
  },
): Promise<void> {
  const pref = await preferenceFor(user.id, type);
  if (pref.inApp) {
    await db.notification.create({
      data: {
        userId: user.id,
        type,
        title: opts.title,
        body: opts.body,
        link: opts.link,
      },
    });
  }
  if (pref.email && opts.templateKey) {
    await sendTemplate(user.email, opts.templateKey, opts.templateVars ?? {});
  }
}

export async function unreadCount(userId: string): Promise<number> {
  return db.notification.count({ where: { userId, readAt: null } });
}
