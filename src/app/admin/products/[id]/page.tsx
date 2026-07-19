import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { SERVER_DRIVERS } from "@/lib/extensions/registry";
import {
  addConfigOption,
  addConfigOptionValue,
  addUpgradePath,
  deleteConfigOption,
  deleteConfigOptionValue,
  deleteProduct,
  removeUpgradePath,
  saveProduct,
} from "@/lib/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { CYCLE_LABELS } from "@/lib/format";
import type { BillingCycle } from "@prisma/client";

const CYCLES = Object.keys(CYCLE_LABELS) as BillingCycle[];

export default async function AdminProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin("products");
  const { id } = await params;
  const isNew = id === "new";

  const [categories, serverExtensions, product] = await Promise.all([
    db.category.findMany({ orderBy: { sortOrder: "asc" } }),
    db.extension.findMany({ where: { type: "SERVER" }, orderBy: { name: "asc" } }),
    isNew
      ? null
      : db.product.findUnique({
          where: { id },
          include: {
            prices: true,
            configOptions: {
              orderBy: { sortOrder: "asc" },
              include: { values: { orderBy: { sortOrder: "asc" } } },
            },
            upgradesFrom: { include: { toProduct: true } },
          },
        }),
  ]);
  const allProducts = isNew
    ? []
    : await db.product.findMany({
        where: { id: { not: id } },
        orderBy: { name: "asc" },
      });
  if (!isNew && !product) notFound();

  const serverConfig = (product?.serverConfig ?? {}) as Record<string, string>;
  const priceFor = (cycle: BillingCycle) =>
    product?.prices.find((p) => p.cycle === cycle);

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {isNew ? "New product" : `Edit: ${product!.name}`}
        </h1>
        {!isNew && (
          <form action={deleteProduct}>
            <input type="hidden" name="id" value={product!.id} />
            <button type="submit" className="btn-danger">
              Delete product
            </button>
          </form>
        )}
      </div>

      <div className="card mt-6 p-6">
        <ActionForm action={saveProduct}>
          {!isNew && <input type="hidden" name="id" value={product!.id} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="name">
                Name
              </label>
              <input
                id="name"
                name="name"
                required
                defaultValue={product?.name}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="categoryId">
                Category
              </label>
              <select
                id="categoryId"
                name="categoryId"
                className="input"
                defaultValue={product?.categoryId}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="description">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              defaultValue={product?.description ?? ""}
              className="input"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="stock">
                Stock (blank = unlimited)
              </label>
              <input
                id="stock"
                name="stock"
                type="number"
                defaultValue={product?.stock ?? ""}
                className="input"
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                id="hidden"
                name="hidden"
                type="checkbox"
                defaultChecked={product?.hidden}
              />
              <label htmlFor="hidden" className="text-sm">
                Hidden
              </label>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                id="allowQuantity"
                name="allowQuantity"
                type="checkbox"
                defaultChecked={product?.allowQuantity}
              />
              <label htmlFor="allowQuantity" className="text-sm">
                Allow quantity &gt; 1
              </label>
            </div>
          </div>

          <h2 className="border-t border-slate-200 pt-4 font-semibold">
            Pricing
          </h2>
          <p className="-mt-2 text-sm text-slate-500">
            Leave a price blank to not offer that cycle.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {CYCLES.map((cycle) => {
              const price = priceFor(cycle);
              return (
                <div
                  key={cycle}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 p-3"
                >
                  <span className="w-32 text-sm">{CYCLE_LABELS[cycle]}</span>
                  <input
                    name={`price_${cycle}`}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Price"
                    defaultValue={price ? Number(price.price) : ""}
                    className="input"
                  />
                  <input
                    name={`setup_${cycle}`}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Setup"
                    defaultValue={
                      price && Number(price.setupFee) > 0
                        ? Number(price.setupFee)
                        : ""
                    }
                    className="input"
                  />
                </div>
              );
            })}
          </div>

          <h2 className="border-t border-slate-200 pt-4 font-semibold">
            Provisioning
          </h2>
          <div>
            <label className="label" htmlFor="serverExtensionId">
              Server extension
            </label>
            <select
              id="serverExtensionId"
              name="serverExtensionId"
              className="input"
              defaultValue={product?.serverExtensionId ?? ""}
            >
              <option value="">None (manual provisioning)</option>
              {serverExtensions.map((ext) => (
                <option key={ext.id} value={ext.id}>
                  {ext.name}
                  {ext.enabled ? "" : " (disabled)"}
                </option>
              ))}
            </select>
          </div>
          {SERVER_DRIVERS.map((driver) => {
            const ext = serverExtensions.find((e) => e.slug === driver.slug);
            if (!ext) return null;
            return (
              <details
                key={driver.slug}
                className="rounded-lg border border-slate-200 p-4"
                open={product?.serverExtensionId === ext.id}
              >
                <summary className="cursor-pointer text-sm font-medium">
                  {driver.name} product settings
                </summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {driver.productConfigFields.map((field) => (
                    <div key={field.key}>
                      <label className="label" htmlFor={`sc_${field.key}`}>
                        {field.label}
                      </label>
                      <input
                        id={`sc_${field.key}`}
                        name={`sc_${field.key}`}
                        defaultValue={serverConfig[field.key] ?? ""}
                        className="input"
                      />
                    </div>
                  ))}
                </div>
              </details>
            );
          })}

          <SubmitButton className="btn-primary">
            {isNew ? "Create product" : "Save product"}
          </SubmitButton>
        </ActionForm>
      </div>

      {!isNew && (
        <div className="card mt-8 p-6">
          <h2 className="font-semibold">Configurable options</h2>
          <p className="mt-1 text-sm text-slate-500">
            Options customers pick at checkout (e.g. RAM). Value prices are
            per month and scale with the billing cycle.
          </p>

          {product!.configOptions.map((option) => (
            <div
              key={option.id}
              className="mt-4 rounded-lg border border-slate-200 p-4"
            >
              <div className="flex items-center justify-between">
                <p className="font-medium">
                  {option.name}
                  {option.envKey && (
                    <code className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                      {option.envKey}
                    </code>
                  )}
                </p>
                <form action={deleteConfigOption}>
                  <input type="hidden" name="id" value={option.id} />
                  <input type="hidden" name="productId" value={product!.id} />
                  <button
                    type="submit"
                    className="text-sm text-red-600 hover:underline"
                  >
                    Remove option
                  </button>
                </form>
              </div>
              <ul className="mt-3 space-y-1">
                {option.values.map((value) => (
                  <li
                    key={value.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>
                      {value.label}{" "}
                      <span className="text-slate-400">
                        ({value.value}, +${Number(value.price)}/mo)
                      </span>
                    </span>
                    <form action={deleteConfigOptionValue}>
                      <input type="hidden" name="id" value={value.id} />
                      <input
                        type="hidden"
                        name="productId"
                        value={product!.id}
                      />
                      <button
                        type="submit"
                        className="text-red-600 hover:underline"
                      >
                        ×
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
              <form
                action={addConfigOptionValue}
                className="mt-3 flex flex-wrap items-end gap-2"
              >
                <input type="hidden" name="optionId" value={option.id} />
                <input type="hidden" name="productId" value={product!.id} />
                <input
                  name="label"
                  placeholder="Label (e.g. 4 GB)"
                  required
                  className="input w-36"
                />
                <input
                  name="value"
                  placeholder="Value (e.g. 4096)"
                  required
                  className="input w-36"
                />
                <input
                  name="price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Price/mo"
                  className="input w-28"
                />
                <button type="submit" className="btn-secondary">
                  Add value
                </button>
              </form>
            </div>
          ))}

          <div className="mt-6 border-t border-slate-200 pt-4">
            <h3 className="font-semibold">Upgrade paths</h3>
            <p className="mt-1 text-sm text-slate-500">
              Products customers can upgrade this product's services to
              (prorated for the remaining period).
            </p>
            <ul className="mt-3 space-y-1">
              {product!.upgradesFrom.map((path) => (
                <li
                  key={path.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span>→ {path.toProduct.name}</span>
                  <form action={removeUpgradePath}>
                    <input type="hidden" name="id" value={path.id} />
                    <input
                      type="hidden"
                      name="fromProductId"
                      value={product!.id}
                    />
                    <button
                      type="submit"
                      className="text-red-600 hover:underline"
                    >
                      ×
                    </button>
                  </form>
                </li>
              ))}
              {product!.upgradesFrom.length === 0 && (
                <li className="text-sm text-slate-400">No upgrade paths.</li>
              )}
            </ul>
            <form action={addUpgradePath} className="mt-3 flex items-end gap-2">
              <input type="hidden" name="fromProductId" value={product!.id} />
              <select name="toProductId" className="input w-64">
                {allProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn-secondary">
                Add path
              </button>
            </form>
          </div>

          <form
            action={addConfigOption}
            className="mt-5 flex flex-wrap items-end gap-2 border-t border-slate-200 pt-4"
          >
            <input type="hidden" name="productId" value={product!.id} />
            <div>
              <label className="label">Option name</label>
              <input name="name" placeholder="e.g. Memory" required className="input w-44" />
            </div>
            <div>
              <label className="label">Env variable (optional)</label>
              <input name="envKey" placeholder="e.g. SERVER_MEMORY" className="input w-44" />
            </div>
            <button type="submit" className="btn-secondary">
              Add option
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
