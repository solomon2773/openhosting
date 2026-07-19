import Link from "next/link";
import { getUser } from "@/lib/auth";
import { readCart, readCoupon } from "@/lib/cart";
import { computeTotals, priceCart } from "@/lib/services/orders";
import { formatMoney, CYCLE_LABELS } from "@/lib/format";
import { applyCoupon, checkout, removeFromCart } from "@/lib/actions/cart";
import { ActionForm, SubmitButton } from "@/components/forms";

export const metadata = { title: "Cart" };

export default async function CartPage() {
  const [user, cart, couponCode] = await Promise.all([
    getUser(),
    readCart(),
    readCoupon(),
  ]);
  const lines = await priceCart(cart);
  const totals = await computeTotals(lines, couponCode, user?.country ?? null);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold">Your cart</h1>
      {lines.length === 0 ? (
        <div className="card mt-8 p-12 text-center text-slate-500">
          <p>Your cart is empty.</p>
          <Link href="/" className="btn-primary mt-4">
            Browse products
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="card divide-y divide-slate-100">
            {lines.map((line, index) => (
              <div
                key={index}
                className="flex items-start justify-between gap-4 p-5"
              >
                <div>
                  <p className="font-medium">{line.name}</p>
                  <p className="text-sm text-slate-500">
                    {CYCLE_LABELS[line.cycle]}
                    {line.quantity > 1 && ` × ${line.quantity}`}
                  </p>
                  {line.config.map((c) => (
                    <p key={c.option} className="text-xs text-slate-400">
                      {c.option}: {c.label}
                    </p>
                  ))}
                  {line.setupFee > 0 && (
                    <p className="text-xs text-slate-400">
                      Setup fee: {formatMoney(line.setupFee, totals.currency)}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <p className="font-semibold">
                    {formatMoney(line.lineTotal, totals.currency)}
                  </p>
                  <form action={removeFromCart}>
                    <input type="hidden" name="index" value={index} />
                    <button
                      type="submit"
                      className="text-sm text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <div className="card p-5">
              <h2 className="mb-3 font-semibold">Coupon</h2>
              <ActionForm action={applyCoupon} className="space-y-3">
                <input
                  name="code"
                  defaultValue={couponCode ?? ""}
                  placeholder="Coupon code"
                  className="input"
                />
                <SubmitButton className="btn-secondary w-full">
                  Apply
                </SubmitButton>
              </ActionForm>
            </div>

            <div className="card p-5">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Subtotal</dt>
                  <dd>{formatMoney(totals.subtotal, totals.currency)}</dd>
                </div>
                {totals.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <dt>Discount</dt>
                    <dd>-{formatMoney(totals.discount, totals.currency)}</dd>
                  </div>
                )}
                {totals.tax > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Tax</dt>
                    <dd>{formatMoney(totals.tax, totals.currency)}</dd>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold">
                  <dt>Total due today</dt>
                  <dd>{formatMoney(totals.total, totals.currency)}</dd>
                </div>
              </dl>
              <form action={checkout} className="mt-4">
                <SubmitButton className="btn-primary w-full">
                  {user ? "Checkout" : "Sign in to checkout"}
                </SubmitButton>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
