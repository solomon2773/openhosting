import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { convertFromBase, getActiveCurrency } from "@/lib/services/currency";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: slug } = await params;
  const [currency, category] = await Promise.all([
    getActiveCurrency(),
    db.category.findUnique({
      where: { slug },
      include: {
        products: {
          where: { hidden: false },
          orderBy: { sortOrder: "asc" },
          include: { prices: { orderBy: { price: "asc" } } },
        },
      },
    }),
  ]);
  if (!category || category.hidden) notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-bold">{category.name}</h1>
      {category.description && (
        <p className="mt-2 max-w-2xl text-slate-600">{category.description}</p>
      )}
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {category.products.map((product) => {
          const cheapest = product.prices[0];
          const soldOut = product.stock !== null && product.stock <= 0;
          return (
            <div key={product.id} className="card flex flex-col p-6">
              <h2 className="text-lg font-semibold">{product.name}</h2>
              {product.description && (
                <p className="mt-2 flex-1 text-sm whitespace-pre-line text-slate-500">
                  {product.description}
                </p>
              )}
              <div className="mt-4 flex items-end justify-between">
                {cheapest ? (
                  <p className="text-sm text-slate-500">
                    From{" "}
                    <span className="text-xl font-semibold text-slate-900">
                      {formatMoney(
                        convertFromBase(Number(cheapest.price), currency),
                        currency.code,
                      )}
                    </span>
                  </p>
                ) : (
                  <span />
                )}
                {soldOut ? (
                  <span className="badge bg-slate-100 text-slate-500">
                    Out of stock
                  </span>
                ) : (
                  <Link
                    href={`/store/${category.slug}/${product.slug}`}
                    className="btn-primary"
                  >
                    Order
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {category.products.length === 0 && (
        <p className="py-16 text-center text-slate-500">
          No products in this category yet.
        </p>
      )}
    </div>
  );
}
