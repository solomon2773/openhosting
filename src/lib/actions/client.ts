"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, requireUser, verifyPassword } from "@/lib/auth";
import { payWithCredits, startGatewayPayment } from "@/lib/services/payments";
import { audit } from "@/lib/audit";
import { getSettings } from "@/lib/settings";
import { sendTemplate } from "@/lib/mail";
import type { FormState } from "@/lib/actions/auth";

// ── Profile ─────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  companyName: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
});

export async function updateProfile(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "First and last name are required." };
  await db.user.update({
    where: { id: user.id },
    data: parsed.data,
  });
  revalidatePath("/dashboard/account");
  return { success: "Profile updated." };
}

export async function changePassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("password") ?? "");
  if (next.length < 8) {
    return { error: "New password must be at least 8 characters." };
  }
  if (!(await verifyPassword(current, user.password))) {
    return { error: "Current password is incorrect." };
  }
  await db.user.update({
    where: { id: user.id },
    data: { password: await hashPassword(next) },
  });
  await audit("user.password_changed", { userId: user.id });
  return { success: "Password updated." };
}

// ── Invoices ────────────────────────────────────────────────────────────────

export async function payInvoice(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const invoiceId = String(formData.get("invoiceId") ?? "");
  const method = String(formData.get("method") ?? "");

  const invoice = await db.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice || invoice.userId !== user.id) {
    return { error: "Invoice not found." };
  }

  if (method === "credits") {
    const result = await payWithCredits(invoiceId, user.id);
    if (result.error) return { error: result.error };
    revalidatePath(`/dashboard/invoices/${invoiceId}`);
    return { success: "Invoice paid with account credit." };
  }

  let result;
  try {
    result = await startGatewayPayment(invoiceId, method);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Payment failed." };
  }
  if (result.type === "redirect") redirect(result.url);
  return { success: result.html };
}

// ── Services ────────────────────────────────────────────────────────────────

export async function requestServiceCancellation(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const serviceId = String(formData.get("serviceId") ?? "");
  const mode = String(formData.get("mode") ?? "end_of_term");
  const service = await db.service.findUnique({ where: { id: serviceId } });
  if (!service || service.userId !== user.id) {
    return { error: "Service not found." };
  }
  if (service.status === "CANCELLED") {
    return { error: "Service is already cancelled." };
  }

  // Either way, open renewal invoices are voided.
  await db.invoice.updateMany({
    where: { status: "PENDING", items: { some: { serviceId } } },
    data: { status: "CANCELLED" },
  });

  if (mode === "end_of_term" && service.expiresAt && service.expiresAt > new Date()) {
    await db.service.update({
      where: { id: serviceId },
      data: { cancelAtPeriodEnd: true },
    });
    await audit("service.cancellation_scheduled", {
      userId: user.id,
      targetType: "service",
      targetId: serviceId,
    });
    revalidatePath(`/dashboard/services/${serviceId}`);
    return {
      success: "Your service will cancel at the end of the paid period.",
    };
  }

  await db.service.update({
    where: { id: serviceId },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });
  await audit("service.cancelled_by_user", {
    userId: user.id,
    targetType: "service",
    targetId: serviceId,
  });
  revalidatePath(`/dashboard/services/${serviceId}`);
  return { success: "Your service has been cancelled." };
}

// ── Tickets ─────────────────────────────────────────────────────────────────

const ticketSchema = z.object({
  subject: z.string().min(3, "Subject is too short"),
  department: z.string().min(1),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  message: z.string().min(10, "Please describe your issue in more detail"),
});

export async function createTicket(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = ticketSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const ticket = await db.ticket.create({
    data: {
      userId: user.id,
      subject: parsed.data.subject,
      department: parsed.data.department,
      priority: parsed.data.priority,
      messages: {
        create: { userId: user.id, message: parsed.data.message },
      },
    },
  });
  await audit("ticket.created", {
    userId: user.id,
    targetType: "ticket",
    targetId: ticket.id,
  });
  redirect(`/dashboard/tickets/${ticket.id}`);
}

export async function replyTicket(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const ticketId = String(formData.get("ticketId") ?? "");
  const message = String(formData.get("message") ?? "").trim();
  if (message.length === 0) return { error: "Reply cannot be empty." };

  const ticket = await db.ticket.findUnique({
    where: { id: ticketId },
    include: { user: true },
  });
  if (!ticket) return { error: "Ticket not found." };
  const isStaff = Boolean(user.roleId);
  if (!isStaff && ticket.userId !== user.id) {
    return { error: "Ticket not found." };
  }

  await db.ticket.update({
    where: { id: ticketId },
    data: {
      status: isStaff ? "ANSWERED" : "CUSTOMER_REPLY",
      messages: { create: { userId: user.id, message } },
    },
  });

  // Notify the other party
  if (isStaff && ticket.userId !== user.id) {
    const settings = await getSettings(["company_url"]);
    await sendTemplate(ticket.user.email, "ticket_reply", {
      name: ticket.user.firstName,
      ticket: String(ticket.number),
      subject: ticket.subject,
      link: `${settings.company_url}/dashboard/tickets/${ticket.id}`,
    });
  }
  revalidatePath(`/dashboard/tickets/${ticketId}`);
  revalidatePath(`/admin/tickets/${ticketId}`);
  return null;
}

export async function closeTicket(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const ticketId = String(formData.get("ticketId") ?? "");
  const ticket = await db.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return { error: "Ticket not found." };
  if (!user.roleId && ticket.userId !== user.id) {
    return { error: "Ticket not found." };
  }
  await db.ticket.update({
    where: { id: ticketId },
    data: { status: "CLOSED" },
  });
  revalidatePath(`/dashboard/tickets/${ticketId}`);
  revalidatePath(`/admin/tickets/${ticketId}`);
  return { success: "Ticket closed." };
}
