import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withApiKey } from "@/lib/api-auth";

export const GET = withApiKey("products:read", async () => {
  const products = await db.product.findMany({
    orderBy: { sortOrder: "asc" },
    include: { category: true, prices: true },
  });
  return NextResponse.json({
    data: products.map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      category: product.category.slug,
      hidden: product.hidden,
      stock: product.stock,
      prices: product.prices.map((price) => ({
        cycle: price.cycle,
        price: Number(price.price),
        setup_fee: Number(price.setupFee),
      })),
    })),
  });
});
