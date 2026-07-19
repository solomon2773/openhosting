import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { getSetting } from "@/lib/settings";

export const metadata = { title: "Products" };

export default async function AdminProductsPage() {
  await requireAdmin("products");
  const [currency, products] = await Promise.all([
    getSetting("currency"),
    db.product.findMany({
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
      include: {
        category: true,
        prices: { orderBy: { price: "asc" }, take: 1 },
        _count: { select: { services: true } },
      },
    }),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Products</h1>
        <Link href="/admin/products/new" className="btn-primary">
          New product
        </Link>
      </div>
      <div className="card mt-6">
        <table className="table-base">
          <thead>
            <tr>
              <th>Product</th>
              <th>Category</th>
              <th>From</th>
              <th>Services</th>
              <th>Stock</th>
              <th>Visible</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td>
                  <Link
                    href={`/admin/products/${product.id}`}
                    className="font-medium text-brand-600 hover:underline"
                  >
                    {product.name}
                  </Link>
                </td>
                <td>{product.category.name}</td>
                <td>
                  {product.prices[0]
                    ? formatMoney(product.prices[0].price, currency)
                    : "—"}
                </td>
                <td>{product._count.services}</td>
                <td>{product.stock ?? "∞"}</td>
                <td>{product.hidden ? "Hidden" : "Yes"}</td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  No products yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
