"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
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

export async function saveKbCategory(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin("knowledgebase");
  const id = str(formData, "id");
  const name = str(formData, "name");
  if (!name) return { error: "Name is required." };
  const data = {
    name,
    slug: str(formData, "slug") || slugify(name),
    description: str(formData, "description") || null,
    sortOrder: Number(formData.get("sortOrder") ?? 0),
  };
  if (id) {
    await db.kbCategory.update({ where: { id }, data });
  } else {
    await db.kbCategory.create({ data });
  }
  revalidatePath("/admin/knowledgebase");
  revalidatePath("/kb");
  return { success: "Category saved." };
}

export async function deleteKbCategory(formData: FormData): Promise<void> {
  await requireAdmin("knowledgebase");
  await db.kbCategory.delete({ where: { id: str(formData, "id") } });
  revalidatePath("/admin/knowledgebase");
  revalidatePath("/kb");
}

// ── Articles ────────────────────────────────────────────────────────────────

export async function saveKbArticle(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin("knowledgebase");
  const id = str(formData, "id");
  const title = str(formData, "title");
  if (!title) return { error: "Title is required." };
  const data = {
    title,
    slug: str(formData, "slug") || slugify(title),
    body: str(formData, "body"),
    categoryId: str(formData, "categoryId") || null,
    published: formData.get("published") === "on",
  };
  if (id) {
    await db.kbArticle.update({ where: { id }, data });
  } else {
    await db.kbArticle.create({ data });
  }
  await audit("admin.kb_article_saved", { userId: admin.id });
  revalidatePath("/admin/knowledgebase");
  revalidatePath("/kb");
  return { success: "Article saved." };
}

export async function deleteKbArticle(formData: FormData): Promise<void> {
  await requireAdmin("knowledgebase");
  await db.kbArticle.delete({ where: { id: str(formData, "id") } });
  revalidatePath("/admin/knowledgebase");
  revalidatePath("/kb");
}
