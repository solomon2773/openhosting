"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { sendMail } from "@/lib/mail";
import { audit } from "@/lib/audit";
import type { FormState } from "@/lib/actions/auth";
import type { Prisma } from "@/generated/prisma/client";

// Resolves the recipient set for an audience segment.
async function audienceUsers(audience: string) {
  const where: Prisma.UserWhereInput =
    audience === "active_service"
      ? { services: { some: { status: "ACTIVE" } } }
      : audience === "no_service"
        ? { services: { none: {} } }
        : {};
  return db.user.findMany({ where, select: { email: true, firstName: true } });
}

export async function sendMassMail(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin("mass-mail");
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const audience = String(formData.get("audience") ?? "all");
  if (!subject || !body) return { error: "Subject and body are required." };

  const recipients = await audienceUsers(audience);
  if (recipients.length === 0) {
    return { error: "That audience has no recipients." };
  }

  // {{name}} personalizes the greeting per recipient
  let sent = 0;
  for (const recipient of recipients) {
    const html = body.replace(/\{\{name\}\}/g, recipient.firstName);
    const ok = await sendMail(recipient.email, subject, html);
    if (ok) sent++;
  }

  await db.massMail.create({
    data: { subject, body, audience, sentCount: sent },
  });
  await audit("admin.mass_mail_sent", {
    userId: admin.id,
    metadata: { audience, recipients: recipients.length, sent },
  });
  revalidatePath("/admin/mass-mail");
  return {
    success: `Sent to ${sent} of ${recipients.length} recipients.`,
  };
}
