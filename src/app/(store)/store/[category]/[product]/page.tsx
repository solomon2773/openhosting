import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { ProductConfigurator } from "./configurator";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ category: string; product: string }>;
}) {
  const { product: slug } = await params;
  const [currency, product] = await Promise.all([
    getSetting("currency"),
    db.product.findUnique({
      where: { slug },
      include: {
        category: true,
        prices: { orderBy: { price: "asc" } },
        configOptions: {
          orderBy: { sortOrder: "asc" },
          include: { values: { orderBy: { sortOrder: "asc" } } },
        },
      },
    }),
  ]);
  if (!product || product.hidden) notFound();
  const soldOut = product.stock !== null && product.stock <= 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <p className="text-sm text-slate-500">
        {product.category.name} / {product.name}
      </p>
      <div className="mt-4 grid gap-10 lg:grid-cols-[1fr_420px]">
        <div>
          <h1 className="text-3xl font-bold">{product.name}</h1>
          {product.description && (
            <p className="mt-4 whitespace-pre-line text-slate-600">
              {product.description}
            </p>
          )}
        </div>
        <div className="card h-fit p-6">
          <h2 className="mb-4 text-lg font-semibold">Configure your plan</h2>
          {soldOut ? (
            <p className="text-slate-500">
              This product is currently out of stock.
            </p>
          ) : (
            <ProductConfigurator
              productId={product.id}
              currency={currency}
              allowQuantity={product.allowQuantity}
              prices={product.prices.map((p) => ({
                cycle: p.cycle,
                price: Number(p.price),
                setupFee: Number(p.setupFee),
              }))}
              options={product.configOptions.map((o) => ({
                id: o.id,
                name: o.name,
                values: o.values.map((v) => ({
                  id: v.id,
                  label: v.label,
                  price: Number(v.price),
                })),
              }))}
            />
          )}
        </div>
      </div>
    </div>
  );
}
