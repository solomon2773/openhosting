import "server-only";
import nodemailer from "nodemailer";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";

// Renders {{placeholder}} substitutions in stored email templates.
function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

export async function sendMail(to: string, subject: string, html: string) {
  const smtp = await getSettings([
    "smtp_host",
    "smtp_port",
    "smtp_user",
    "smtp_pass",
    "smtp_secure",
    "mail_from",
    "company_name",
  ]);

  if (!smtp.smtp_host) {
    await db.emailLog.create({
      data: { to, subject, status: "failed", error: "SMTP not configured" },
    });
    return false;
  }

  try {
    const transport = nodemailer.createTransport({
      host: smtp.smtp_host,
      port: Number(smtp.smtp_port) || 587,
      secure: smtp.smtp_secure === "true",
      auth: smtp.smtp_user
        ? { user: smtp.smtp_user, pass: smtp.smtp_pass }
        : undefined,
    });
    await transport.sendMail({
      from: `"${smtp.company_name}" <${smtp.mail_from}>`,
      to,
      subject,
      html,
    });
    await db.emailLog.create({ data: { to, subject, status: "sent" } });
    return true;
  } catch (err) {
    await db.emailLog.create({
      data: {
        to,
        subject,
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      },
    });
    return false;
  }
}

export async function sendTemplate(
  to: string,
  key: string,
  vars: Record<string, string>,
) {
  const template = await db.emailTemplate.findUnique({ where: { key } });
  if (!template || !template.enabled) return false;
  return sendMail(to, render(template.subject, vars), render(template.body, vars));
}

export const DEFAULT_EMAIL_TEMPLATES: Array<{
  key: string;
  subject: string;
  body: string;
}> = [
  {
    key: "welcome",
    subject: "Welcome to {{company}}",
    body: "<p>Hi {{name}},</p><p>Your account at {{company}} has been created. You can sign in at {{url}}.</p>",
  },
  {
    key: "verify_email",
    subject: "Verify your email address",
    body: "<p>Hi {{name}},</p><p>Please confirm your email address by clicking <a href=\"{{link}}\">this link</a>. The link expires in 60 minutes.</p>",
  },
  {
    key: "password_reset",
    subject: "Reset your password",
    body: "<p>Hi {{name}},</p><p>Click <a href=\"{{link}}\">here</a> to reset your password. The link expires in 60 minutes. If you didn't request this, ignore this email.</p>",
  },
  {
    key: "invoice_created",
    subject: "Invoice #{{invoice}} from {{company}}",
    body: "<p>Hi {{name}},</p><p>A new invoice <strong>#{{invoice}}</strong> for {{total}} is due on {{due}}. Pay it at <a href=\"{{link}}\">{{link}}</a>.</p>",
  },
  {
    key: "invoice_paid",
    subject: "Payment received for invoice #{{invoice}}",
    body: "<p>Hi {{name}},</p><p>We received your payment of {{total}} for invoice <strong>#{{invoice}}</strong>. Thank you!</p>",
  },
  {
    key: "service_activated",
    subject: "Your service {{product}} is active",
    body: "<p>Hi {{name}},</p><p>Your service <strong>{{product}}</strong> is now active. Manage it at {{url}}.</p>",
  },
  {
    key: "service_suspended",
    subject: "Your service {{product}} was suspended",
    body: "<p>Hi {{name}},</p><p>Your service <strong>{{product}}</strong> was suspended due to an unpaid invoice. Pay the outstanding invoice to restore it.</p>",
  },
  {
    key: "ticket_reply",
    subject: "New reply on ticket #{{ticket}}: {{subject}}",
    body: "<p>Hi {{name}},</p><p>There is a new reply on your ticket <strong>#{{ticket}}</strong>. View it at <a href=\"{{link}}\">{{link}}</a>.</p>",
  },
];
