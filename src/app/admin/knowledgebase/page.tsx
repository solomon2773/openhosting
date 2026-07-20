import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  deleteKbArticle,
  deleteKbCategory,
  saveKbArticle,
  saveKbCategory,
} from "@/lib/actions/knowledgebase";
import { ActionForm, SubmitButton } from "@/components/forms";

export const metadata = { title: "Knowledgebase" };

export default async function AdminKbPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  await requireAdmin("knowledgebase");
  const { edit } = await searchParams;
  const [categories, articles, editing] = await Promise.all([
    db.kbCategory.findMany({ orderBy: { sortOrder: "asc" } }),
    db.kbArticle.findMany({
      orderBy: { updatedAt: "desc" },
      include: { category: true },
    }),
    edit ? db.kbArticle.findUnique({ where: { id: edit } }) : null,
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Knowledgebase</h1>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          <div className="card">
            <h2 className="px-5 py-4 font-semibold">Articles</h2>
            <table className="table-base">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Views</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {articles.map((article) => (
                  <tr key={article.id}>
                    <td>
                      <a
                        href={`/admin/knowledgebase?edit=${article.id}`}
                        className="font-medium text-brand-600 hover:underline"
                      >
                        {article.title}
                      </a>
                    </td>
                    <td>{article.category?.name ?? "—"}</td>
                    <td>{article.views}</td>
                    <td>
                      <span
                        className={`badge ${article.published ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}
                      >
                        {article.published ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td className="text-right">
                      <form action={deleteKbArticle}>
                        <input type="hidden" name="id" value={article.id} />
                        <button
                          type="submit"
                          className="text-sm text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {articles.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No articles yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h2 className="px-5 py-4 font-semibold">Categories</h2>
            <table className="table-base">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Slug</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id}>
                    <td className="font-medium">{category.name}</td>
                    <td className="text-slate-500">{category.slug}</td>
                    <td className="text-right">
                      <form action={deleteKbCategory}>
                        <input type="hidden" name="id" value={category.id} />
                        <button
                          type="submit"
                          className="text-sm text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {categories.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-slate-400">
                      No categories.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="border-t border-slate-100 p-5">
              <ActionForm action={saveKbCategory} className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="label">New category</label>
                  <input name="name" placeholder="Name" required className="input w-48" />
                </div>
                <input name="description" placeholder="Description" className="input w-56" />
                <SubmitButton className="btn-secondary">Add</SubmitButton>
              </ActionForm>
            </div>
          </div>
        </div>

        <div className="card h-fit p-5">
          <h2 className="mb-4 font-semibold">
            {editing ? "Edit article" : "New article"}
          </h2>
          <ActionForm action={saveKbArticle}>
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div>
              <label className="label">Title</label>
              <input name="title" required defaultValue={editing?.title} className="input" />
            </div>
            <div>
              <label className="label">Category</label>
              <select name="categoryId" defaultValue={editing?.categoryId ?? ""} className="input">
                <option value="">Uncategorized</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Body (plain text / basic HTML)</label>
              <textarea name="body" rows={10} required defaultValue={editing?.body} className="input" />
            </div>
            <div className="flex items-center gap-2">
              <input id="published" name="published" type="checkbox" defaultChecked={editing?.published} />
              <label htmlFor="published" className="text-sm">Published</label>
            </div>
            <SubmitButton className="btn-primary">
              {editing ? "Save article" : "Create article"}
            </SubmitButton>
          </ActionForm>
        </div>
      </div>
    </div>
  );
}
