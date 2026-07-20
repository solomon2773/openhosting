"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { BillingCycle, CouponType, TicketStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { markInvoicePaid } from "@/lib/billing";
import { setSetting } from "@/lib/settings";
import { audit } from "@/lib/audit";
import {
  provisionCreate,
  provisionSuspend,
  provisionTerminate,
  provisionUnsuspend,
} from "@/lib/services/provisioning";
import type { FormState } from "@/lib/actions/auth";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

// ── Categories ──────────────────────────────────────────────────────────────

export async function saveCategory(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin("categories");
  const id = str(formData, "id");
  const name = str(formData, "name");
  if (!name) return { error: "Name is required." };
  const data = {
    name,
    slug: str(formData, "slug") || slugify(name),
    description: str(formData, "description") || null,
    sortOrder: Number(formData.get("sortOrder") ?? 0),
    hidden: formData.get("hidden") === "on",
  };
  if (id) {
    await db.category.update({ where: { id }, data });
  } else {
    await db.category.create({ data });
  }
  await audit("admin.category_saved", { userId: admin.id });
  revalidatePath("/admin/categories");
  return { success: "Category saved." };
}

export async function deleteCategory(formData: FormData): Promise<void> {
  const admin = await requireAdmin("categories");
  await db.category.delete({ where: { id: str(formData, "id") } });
  await audit("admin.category_deleted", { userId: admin.id });
  revalidatePath("/admin/categories");
}

// ── Products ────────────────────────────────────────────────────────────────

const CYCLES: BillingCycle[] = [
  "ONE_TIME",
  "MONTHLY",
  "QUARTERLY",
  "SEMI_ANNUALLY",
  "ANNUALLY",
  "BIENNIALLY",
];

export async function saveProduct(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin("products");
  const id = str(formData, "id");
  const name = str(formData, "name");
  const categoryId = str(formData, "categoryId");
  if (!name || !categoryId) {
    return { error: "Name and category are required." };
  }

  const serverExtensionId = str(formData, "serverExtensionId") || null;
  let serverConfig: Record<string, string> | undefined;
  if (serverExtensionId) {
    serverConfig = {};
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("sc_")) serverConfig[key.slice(3)] = String(value);
    }
  }

  const resaleExtensionId = str(formData, "resaleExtensionId") || null;
  let resaleConfig: Record<string, string> | undefined;
  if (resaleExtensionId) {
    resaleConfig = {};
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("rc_")) resaleConfig[key.slice(3)] = String(value);
    }
  }

  const stockRaw = str(formData, "stock");
  const data = {
    name,
    slug: str(formData, "slug") || slugify(name),
    description: str(formData, "description") || null,
    categoryId,
    stock: stockRaw === "" ? null : Number(stockRaw),
    hidden: formData.get("hidden") === "on",
    allowQuantity: formData.get("allowQuantity") === "on",
    sortOrder: Number(formData.get("sortOrder") ?? 0),
    serverExtensionId,
    ...(serverConfig !== undefined ? { serverConfig } : {}),
    resaleExtensionId,
    ...(resaleConfig !== undefined ? { resaleConfig } : {}),
  };

  const product = id
    ? await db.product.update({ where: { id }, data })
    : await db.product.create({ data });

  // Prices: price_<CYCLE> and setup_<CYCLE> inputs; blank price = not offered.
  for (const cycle of CYCLES) {
    const priceRaw = str(formData, `price_${cycle}`);
    const setupRaw = str(formData, `setup_${cycle}`);
    if (priceRaw === "") {
      await db.productPrice.deleteMany({
        where: { productId: product.id, cycle },
      });
    } else {
      await db.productPrice.upsert({
        where: { productId_cycle: { productId: product.id, cycle } },
        update: { price: Number(priceRaw), setupFee: Number(setupRaw || 0) },
        create: {
          productId: product.id,
          cycle,
          price: Number(priceRaw),
          setupFee: Number(setupRaw || 0),
        },
      });
    }
  }

  await audit("admin.product_saved", {
    userId: admin.id,
    targetType: "product",
    targetId: product.id,
  });
  revalidatePath("/admin/products");
  if (!id) redirect(`/admin/products/${product.id}`);
  return { success: "Product saved." };
}

export async function deleteProduct(formData: FormData): Promise<void> {
  const admin = await requireAdmin("products");
  await db.product.delete({ where: { id: str(formData, "id") } });
  await audit("admin.product_deleted", { userId: admin.id });
  redirect("/admin/products");
}

export async function addConfigOption(formData: FormData): Promise<void> {
  await requireAdmin("products");
  const productId = str(formData, "productId");
  await db.configOption.create({
    data: {
      productId,
      name: str(formData, "name"),
      envKey: str(formData, "envKey") || null,
    },
  });
  revalidatePath(`/admin/products/${productId}`);
}

export async function deleteConfigOption(formData: FormData): Promise<void> {
  await requireAdmin("products");
  await db.configOption.delete({ where: { id: str(formData, "id") } });
  revalidatePath(`/admin/products/${str(formData, "productId")}`);
}

export async function addConfigOptionValue(formData: FormData): Promise<void> {
  await requireAdmin("products");
  await db.configOptionValue.create({
    data: {
      optionId: str(formData, "optionId"),
      label: str(formData, "label"),
      value: str(formData, "value"),
      price: Number(formData.get("price") ?? 0),
    },
  });
  revalidatePath(`/admin/products/${str(formData, "productId")}`);
}

export async function deleteConfigOptionValue(
  formData: FormData,
): Promise<void> {
  await requireAdmin("products");
  await db.configOptionValue.delete({ where: { id: str(formData, "id") } });
  revalidatePath(`/admin/products/${str(formData, "productId")}`);
}

export async function addUpgradePath(formData: FormData): Promise<void> {
  await requireAdmin("products");
  const fromProductId = str(formData, "fromProductId");
  const toProductId = str(formData, "toProductId");
  if (!toProductId || fromProductId === toProductId) return;
  await db.productUpgrade.upsert({
    where: { fromProductId_toProductId: { fromProductId, toProductId } },
    update: {},
    create: { fromProductId, toProductId },
  });
  revalidatePath(`/admin/products/${fromProductId}`);
}

export async function removeUpgradePath(formData: FormData): Promise<void> {
  await requireAdmin("products");
  await db.productUpgrade.delete({ where: { id: str(formData, "id") } });
  revalidatePath(`/admin/products/${str(formData, "fromProductId")}`);
}

// ── Users ───────────────────────────────────────────────────────────────────

export async function saveUser(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin("users");
  const id = str(formData, "id");
  const email = str(formData, "email").toLowerCase();
  if (!email) return { error: "Email is required." };

  const data: Record<string, unknown> = {
    email,
    firstName: str(formData, "firstName"),
    lastName: str(formData, "lastName"),
    country: str(formData, "country") || null,
    credits: Number(formData.get("credits") ?? 0),
    roleId: str(formData, "roleId") || null,
  };
  const password = str(formData, "password");
  if (password) data.password = await hashPassword(password);

  if (id) {
    await db.user.update({ where: { id }, data: data as never });
  } else {
    if (!password) return { error: "Password is required for new users." };
    await db.user.create({ data: data as never });
  }
  await audit("admin.user_saved", { userId: admin.id, targetType: "user", targetId: id });
  revalidatePath("/admin/users");
  return { success: "User saved." };
}

export async function deleteUser(formData: FormData): Promise<void> {
  const admin = await requireAdmin("users");
  const id = str(formData, "id");
  if (id === admin.id) return;
  await db.user.delete({ where: { id } });
  await audit("admin.user_deleted", { userId: admin.id, targetId: id });
  redirect("/admin/users");
}

// ── Invoices ────────────────────────────────────────────────────────────────

export async function adminMarkInvoicePaid(formData: FormData): Promise<void> {
  const admin = await requireAdmin("invoices");
  const id = str(formData, "id");
  await markInvoicePaid(id, "manual", `admin:${admin.id}`);
  await audit("admin.invoice_marked_paid", {
    userId: admin.id,
    targetType: "invoice",
    targetId: id,
  });
  revalidatePath(`/admin/invoices/${id}`);
  revalidatePath("/admin/invoices");
}

export async function adminCancelInvoice(formData: FormData): Promise<void> {
  const admin = await requireAdmin("invoices");
  const id = str(formData, "id");
  await db.invoice.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
  await audit("admin.invoice_cancelled", { userId: admin.id, targetId: id });
  revalidatePath(`/admin/invoices/${id}`);
  revalidatePath("/admin/invoices");
}

// ── Services ────────────────────────────────────────────────────────────────

const serviceInclude = {
  user: true,
  product: { include: { serverExtension: true } },
} as const;

export async function adminServiceAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin("services");
  const id = str(formData, "id");
  const action = str(formData, "serviceAction");
  const service = await db.service.findUnique({
    where: { id },
    include: serviceInclude,
  });
  if (!service) return;

  switch (action) {
    case "activate": {
      const updated = await db.service.update({
        where: { id },
        data: { status: "ACTIVE" },
        include: serviceInclude,
      });
      if (!service.externalId) await provisionCreate(updated);
      break;
    }
    case "suspend":
      await db.service.update({
        where: { id },
        data: { status: "SUSPENDED", suspendedAt: new Date() },
      });
      await provisionSuspend(service);
      break;
    case "unsuspend":
      await db.service.update({
        where: { id },
        data: { status: "ACTIVE", suspendedAt: null },
      });
      await provisionUnsuspend(service);
      break;
    case "terminate":
      await db.service.update({
        where: { id },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });
      await provisionTerminate(service);
      break;
  }
  await audit(`admin.service_${action}`, {
    userId: admin.id,
    targetType: "service",
    targetId: id,
  });
  revalidatePath("/admin/services");
}

// ── Coupons & taxes ─────────────────────────────────────────────────────────

export async function saveCoupon(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin("coupons");
  const code = str(formData, "code").toUpperCase();
  if (!code) return { error: "Code is required." };
  const expiresRaw = str(formData, "expiresAt");
  const maxUsesRaw = str(formData, "maxUses");
  const productIds = formData.getAll("productId").map(String).filter(Boolean);
  await db.coupon.upsert({
    where: { code },
    update: {},
    create: {
      code,
      type: str(formData, "type") as CouponType,
      value: Number(formData.get("value") ?? 0),
      maxUses: maxUsesRaw === "" ? null : Number(maxUsesRaw),
      expiresAt: expiresRaw ? new Date(expiresRaw) : null,
      products: { connect: productIds.map((id) => ({ id })) },
    },
  });
  revalidatePath("/admin/coupons");
  return { success: "Coupon created." };
}

export async function deleteCoupon(formData: FormData): Promise<void> {
  await requireAdmin("coupons");
  await db.coupon.delete({ where: { id: str(formData, "id") } });
  revalidatePath("/admin/coupons");
}

export async function saveTaxRate(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin("settings");
  const name = str(formData, "name");
  if (!name) return { error: "Name is required." };
  await db.taxRate.create({
    data: {
      name,
      rate: Number(formData.get("rate") ?? 0),
      country: str(formData, "country").toUpperCase() || null,
    },
  });
  revalidatePath("/admin/taxes");
  return { success: "Tax rate added." };
}

export async function deleteTaxRate(formData: FormData): Promise<void> {
  await requireAdmin("settings");
  await db.taxRate.delete({ where: { id: str(formData, "id") } });
  revalidatePath("/admin/taxes");
}

// ── Currencies ──────────────────────────────────────────────────────────────

export async function saveCurrency(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin("settings");
  const code = str(formData, "code").toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return { error: "Use a 3-letter ISO code." };
  const rate = Number(formData.get("rate") ?? 0);
  if (rate <= 0) return { error: "Rate must be greater than zero." };
  await db.currency.upsert({
    where: { code },
    update: { rate, enabled: formData.get("enabled") === "on" },
    create: {
      code,
      rate,
      symbol: str(formData, "symbol") || null,
      enabled: formData.get("enabled") === "on",
    },
  });
  revalidatePath("/admin/currencies");
  return { success: "Currency saved." };
}

export async function deleteCurrency(formData: FormData): Promise<void> {
  await requireAdmin("settings");
  await db.currency.delete({ where: { code: str(formData, "code") } });
  revalidatePath("/admin/currencies");
}

// ── Tickets ─────────────────────────────────────────────────────────────────

export async function adminUpdateTicket(formData: FormData): Promise<void> {
  const admin = await requireAdmin("tickets");
  const id = str(formData, "id");
  await db.ticket.update({
    where: { id },
    data: {
      status: str(formData, "status") as TicketStatus,
      assignedToId: str(formData, "assignedToId") || null,
    },
  });
  await audit("admin.ticket_updated", { userId: admin.id, targetId: id });
  revalidatePath(`/admin/tickets/${id}`);
}

// ── Settings ────────────────────────────────────────────────────────────────

export async function saveSettings(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin("settings");
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$") || key.startsWith("__")) continue;
    await setSetting(key, String(value));
  }
  await audit("admin.settings_saved", { userId: admin.id });
  revalidatePath("/admin/settings");
  return { success: "Settings saved." };
}

// ── Extensions ──────────────────────────────────────────────────────────────

export async function saveExtension(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin("extensions");
  const id = str(formData, "id");
  const config: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("cfg_")) config[key.slice(4)] = String(value);
  }
  await db.extension.update({
    where: { id },
    data: { enabled: formData.get("enabled") === "on", config },
  });
  await audit("admin.extension_saved", { userId: admin.id, targetId: id });
  revalidatePath("/admin/extensions");
  return { success: "Extension saved." };
}

// ── Announcements ───────────────────────────────────────────────────────────

export async function saveAnnouncement(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin("announcements");
  const id = str(formData, "id");
  const title = str(formData, "title");
  if (!title) return { error: "Title is required." };
  const data = {
    title,
    slug: str(formData, "slug") || slugify(title),
    excerpt: str(formData, "excerpt") || null,
    body: str(formData, "body"),
    publishedAt: formData.get("published") === "on" ? new Date() : null,
  };
  if (id) {
    const existing = await db.announcement.findUnique({ where: { id } });
    await db.announcement.update({
      where: { id },
      data: {
        ...data,
        // keep the original publish date when it stays published
        publishedAt:
          formData.get("published") === "on"
            ? (existing?.publishedAt ?? new Date())
            : null,
      },
    });
  } else {
    await db.announcement.create({ data });
  }
  await audit("admin.announcement_saved", { userId: admin.id });
  revalidatePath("/admin/announcements");
  revalidatePath("/blog");
  return { success: "Announcement saved." };
}

export async function deleteAnnouncement(formData: FormData): Promise<void> {
  await requireAdmin("announcements");
  await db.announcement.delete({ where: { id: str(formData, "id") } });
  revalidatePath("/admin/announcements");
  revalidatePath("/blog");
}

// ── Email templates ─────────────────────────────────────────────────────────

export async function saveEmailTemplate(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin("settings");
  await db.emailTemplate.update({
    where: { key: str(formData, "key") },
    data: {
      subject: str(formData, "subject"),
      body: str(formData, "body"),
      enabled: formData.get("enabled") === "on",
    },
  });
  revalidatePath("/admin/email-templates");
  return { success: "Template saved." };
}
