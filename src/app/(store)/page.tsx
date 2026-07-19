import Link from "next/link";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { formatMoney } from "@/lib/format";

export default async function HomePage() {
  const [companyName, currency, categories] = await Promise.all([
    getSetting("company_name"),
    getSetting("currency"),
    db.category.findMany({
      where: { hidden: false },
      orderBy: { sortOrder: "asc" },
      include: {
        products: {
          where: { hidden: false },
          orderBy: { sortOrder: "asc" },
          include: { prices: { orderBy: { price: "asc" }, take: 1 } },
          take: 3,
        },
      },
    }),
  ]);

  return (
    <div>
      <section className="bg-gradient-to-b from-brand-50 to-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Hosting that scales with you
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">
            {companyName} offers reliable game servers, VPS and web hosting
            with instant setup and fair pricing.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            {categories[0] && (
              <Link
                href={`/store/${categories[0].slug}`}
                className="btn-primary px-6 py-3 text-base"
              >
                Browse plans
              </Link>
            )}
            <Link
              href="/register"
              className="btn-secondary px-6 py-3 text-base"
            >
              Create account
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        {categories.map((category) => (
          <div key={category.id} className="mb-14">
            <div className="mb-6 flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-semibold">{category.name}</h2>
                {category.description && (
                  <p className="mt-1 text-slate-500">{category.description}</p>
                )}
              </div>
              <Link
                href={`/store/${category.slug}`}
                className="text-sm font-medium text-brand-600 hover:underline"
              >
                View all →
              </Link>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {category.products.map((product) => (
                <Link
                  key={product.id}
                  href={`/store/${category.slug}/${product.slug}`}
                  className="card group p-6 transition-shadow hover:shadow-md"
                >
                  <h3 className="font-semibold text-slate-900 group-hover:text-brand-600">
                    {product.name}
                  </h3>
                  {product.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-slate-500">
                      {product.description}
                    </p>
                  )}
                  {product.prices[0] && (
                    <p className="mt-4 text-sm text-slate-500">
                      From{" "}
                      <span className="text-lg font-semibold text-slate-900">
                        {formatMoney(product.prices[0].price, currency)}
                      </span>
                      /mo
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        ))}
        {categories.length === 0 && (
          <p className="py-20 text-center text-slate-500">
            No products yet. Sign in as an admin to add your catalog.
          </p>
        )}
      </section>
    </div>
  );
}
