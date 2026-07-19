import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteCategory, saveCategory } from "@/lib/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms";

export const metadata = { title: "Categories" };

export default async function AdminCategoriesPage() {
  await requireAdmin("categories");
  const categories = await db.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { products: true } } },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">Categories</h1>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="card">
          <table className="table-base">
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Products</th>
                <th>Visible</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id}>
                  <td className="font-medium">{category.name}</td>
                  <td className="text-slate-500">{category.slug}</td>
                  <td>{category._count.products}</td>
                  <td>{category.hidden ? "Hidden" : "Yes"}</td>
                  <td className="text-right">
                    <form action={deleteCategory}>
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
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No categories yet — create your first one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card h-fit p-5">
          <h2 className="mb-4 font-semibold">New category</h2>
          <ActionForm action={saveCategory}>
            <div>
              <label className="label" htmlFor="name">
                Name
              </label>
              <input id="name" name="name" required className="input" />
            </div>
            <div>
              <label className="label" htmlFor="description">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={2}
                className="input"
              />
            </div>
            <div className="flex items-center gap-2">
              <input id="hidden" name="hidden" type="checkbox" />
              <label htmlFor="hidden" className="text-sm text-slate-600">
                Hidden from storefront
              </label>
            </div>
            <SubmitButton className="btn-primary">Create category</SubmitButton>
          </ActionForm>
        </div>
      </div>
    </div>
  );
}
