import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { publicUrl } from "@/lib/settings";
import {
  convertFromBase,
  getEnabledCurrencies,
} from "@/lib/services/currency";

export async function GET() {
  const [baseUrl, currencies, products] = await Promise.all([
    publicUrl(),
    getEnabledCurrencies(),
    db.product.findMany({
      where: { hidden: false },
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
      include: {
        category: true,
        prices: true,
        configOptions: {
          orderBy: { sortOrder: "asc" },
          include: { values: { orderBy: { sortOrder: "asc" } } },
        },
      },
    }),
  ]);

  return NextResponse.json(
    {
      version: "2026-08-27",
      merchant: { url: baseUrl },
      checkout: {
        endpoint: `${baseUrl}/api/agent/checkout`,
        authentication: "bearer_agent_grant",
        idempotency_header: "Idempotency-Key",
        protocols: {
          native: `${baseUrl}/api/agent/checkout`,
          acp: `${baseUrl}/api/acp/checkout_sessions`,
          acp_version: "2026-04-17",
          x402: "v2",
        },
      },
      currencies: currencies.map((currency) => ({
        code: currency.code,
        kind: currency.kind.toLowerCase(),
        decimals: currency.decimals,
        rate_from_base: currency.rate,
        settlement_networks: currency.settlementNetworks,
      })),
      products: products.map((product) => ({
        id: product.id,
        slug: product.slug,
        name: product.name,
        description: product.description,
        image: product.image,
        category: {
          id: product.category.id,
          slug: product.category.slug,
          name: product.category.name,
        },
        availability: product.stock === 0 ? "out_of_stock" : "in_stock",
        available_quantity: product.stock,
        allow_quantity: product.allowQuantity,
        metered: product.metered
          ? {
              unit: product.meteredUnit,
              unit_price_base: product.meteredUnitPrice?.toString() ?? null,
            }
          : null,
        offers: product.prices.map((price) => ({
          sku: price.id,
          cycle: price.cycle,
          amounts: currencies.map((currency) => ({
            currency: currency.code,
            price: convertFromBase(Number(price.price), currency).toFixed(
              currency.decimals,
            ),
            setup_fee: convertFromBase(Number(price.setupFee), currency).toFixed(
              currency.decimals,
            ),
          })),
        })),
        options: product.configOptions.map((option) => ({
          id: option.id,
          name: option.name,
          values: option.values.map((value) => ({
            id: value.id,
            label: value.label,
            value: value.value,
            monthly_price_base: value.price.toString(),
          })),
        })),
      })),
    },
    { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
  );
}
