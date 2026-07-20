"use client";

import { useMemo, useState } from "react";
import { addToCart } from "@/lib/actions/cart";
import { SubmitButton } from "@/components/forms";

type Price = { cycle: string; price: number; setupFee: number };
type OptionValue = { id: string; label: string; price: number };
type Option = { id: string; name: string; values: OptionValue[] };

const CYCLE_LABELS: Record<string, string> = {
  ONE_TIME: "One-time",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  SEMI_ANNUALLY: "Semi-annually",
  ANNUALLY: "Annually",
  BIENNIALLY: "Biennially",
};

const CYCLE_MONTHS: Record<string, number> = {
  ONE_TIME: 0,
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMI_ANNUALLY: 6,
  ANNUALLY: 12,
  BIENNIALLY: 24,
};

type ResaleField = {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  help?: string;
};

export function ProductConfigurator({
  productId,
  prices,
  options,
  allowQuantity,
  currency,
  resaleFields = [],
}: {
  productId: string;
  prices: Price[];
  options: Option[];
  allowQuantity: boolean;
  currency: string;
  resaleFields?: ResaleField[];
}) {
  const [cycle, setCycle] = useState(prices[0]?.cycle ?? "MONTHLY");
  const [quantity, setQuantity] = useState(1);
  const [selected, setSelected] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      options
        .filter((o) => o.values.length > 0)
        .map((o) => [o.id, o.values[0].id]),
    ),
  );

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);

  const total = useMemo(() => {
    const price = prices.find((p) => p.cycle === cycle);
    if (!price) return { recurring: 0, setup: 0 };
    const months = CYCLE_MONTHS[cycle] || 1;
    const optionsTotal = options.reduce((sum, option) => {
      const value = option.values.find((v) => v.id === selected[option.id]);
      return sum + (value ? value.price * (CYCLE_MONTHS[cycle] === 0 ? 1 : months) : 0);
    }, 0);
    return {
      recurring: (price.price + optionsTotal) * quantity,
      setup: price.setupFee,
    };
  }, [cycle, quantity, selected, prices, options]);

  return (
    <form action={addToCart} className="space-y-6">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="cycle" value={cycle} />
      {Object.values(selected).map((valueId) => (
        <input key={valueId} type="hidden" name="optionValue" value={valueId} />
      ))}

      {resaleFields.length > 0 && (
        <div className="space-y-4 rounded-lg border border-slate-200 p-4">
          {resaleFields.map((field) =>
            field.type === "textarea" || field.key === "csr" ? (
              <div key={field.key}>
                <label className="label" htmlFor={`resale_${field.key}`}>
                  {field.label}
                </label>
                <textarea
                  id={`resale_${field.key}`}
                  name={`resale_${field.key}`}
                  required={field.required}
                  rows={4}
                  className="input font-mono text-xs"
                />
                {field.help && (
                  <p className="mt-1 text-xs text-slate-400">{field.help}</p>
                )}
              </div>
            ) : (
              <div key={field.key}>
                <label className="label" htmlFor={`resale_${field.key}`}>
                  {field.label}
                </label>
                <input
                  id={`resale_${field.key}`}
                  name={`resale_${field.key}`}
                  required={field.required}
                  className="input"
                />
                {field.help && (
                  <p className="mt-1 text-xs text-slate-400">{field.help}</p>
                )}
              </div>
            ),
          )}
        </div>
      )}

      <div>
        <span className="label">Billing cycle</span>
        <div className="grid gap-2 sm:grid-cols-2">
          {prices.map((price) => (
            <button
              key={price.cycle}
              type="button"
              onClick={() => setCycle(price.cycle)}
              className={`rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                cycle === price.cycle
                  ? "border-brand-600 bg-brand-50 text-brand-700"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              <span className="block font-medium">
                {CYCLE_LABELS[price.cycle]}
              </span>
              <span className="text-slate-500">
                {fmt(price.price)}
                {price.setupFee > 0 && ` + ${fmt(price.setupFee)} setup`}
              </span>
            </button>
          ))}
        </div>
      </div>

      {options.map((option) => (
        <div key={option.id}>
          <label className="label" htmlFor={`opt-${option.id}`}>
            {option.name}
          </label>
          <select
            id={`opt-${option.id}`}
            className="input"
            value={selected[option.id] ?? ""}
            onChange={(e) =>
              setSelected((s) => ({ ...s, [option.id]: e.target.value }))
            }
          >
            {option.values.map((value) => (
              <option key={value.id} value={value.id}>
                {value.label}
                {value.price > 0 ? ` (+${fmt(value.price)}/mo)` : ""}
              </option>
            ))}
          </select>
        </div>
      ))}

      {allowQuantity && (
        <div>
          <label className="label" htmlFor="quantity">
            Quantity
          </label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            min={1}
            max={100}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
            className="input w-28"
          />
        </div>
      )}

      <div className="flex items-center justify-between border-t border-slate-200 pt-4">
        <div>
          <p className="text-2xl font-semibold">
            {fmt(total.recurring)}
            <span className="text-sm font-normal text-slate-500">
              {" "}
              / {CYCLE_LABELS[cycle]?.toLowerCase()}
            </span>
          </p>
          {total.setup > 0 && (
            <p className="text-sm text-slate-500">
              + {fmt(total.setup)} setup fee
            </p>
          )}
        </div>
        <SubmitButton className="btn-primary px-6">Add to cart</SubmitButton>
      </div>
    </form>
  );
}
