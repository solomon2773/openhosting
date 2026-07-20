"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import type { FormState } from "@/lib/actions/auth";

const PERMISSIONS = ["invoices", "tickets", "services", "manage"] as const;

const contactSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
});

// Add or update a sub-account contact on the current customer's account.
export async function saveContact(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const parsed = contactSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
  });
  if (!parsed.success) return { error: "Enter a name and valid email." };
  const email = parsed.data.email.toLowerCase();

  const permissions = PERMISSIONS.filter((p) => formData.get(`perm_${p}`) === "on");
  const password = String(formData.get("password") ?? "");

  // email must be unique across users and contacts
  const clashUser = await db.user.findUnique({ where: { email } });
  if (clashUser) return { error: "That email belongs to an existing account." };

  if (id) {
    const existing = await db.contact.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) {
      return { error: "Contact not found." };
    }
    await db.contact.update({
      where: { id },
      data: {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        email,
        permissions,
        ...(password ? { password: await hashPassword(password) } : {}),
      },
    });
  } else {
    const clashContact = await db.contact.findUnique({ where: { email } });
    if (clashContact) return { error: "A contact with that email already exists." };
    await db.contact.create({
      data: {
        userId: user.id,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        email,
        permissions,
        password: password ? await hashPassword(password) : null,
      },
    });
  }
  await audit("user.contact_saved", { userId: user.id });
  revalidatePath("/dashboard/account/contacts");
  return { success: "Contact saved." };
}

export async function deleteContact(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const contact = await db.contact.findUnique({ where: { id } });
  if (contact && contact.userId === user.id) {
    await db.contact.delete({ where: { id } });
  }
  revalidatePath("/dashboard/account/contacts");
}
