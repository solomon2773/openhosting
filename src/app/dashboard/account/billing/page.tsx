import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { db } from "@/lib/db";
import {
  completePaymentMethodSetup,
  storableGateways,
} from "@/lib/services/payments";
import {
  beginCardSetup,
  makeMethodDefault,
  removeStoredMethod,
} from "@/lib/actions/billing-methods";
import { SubmitButton } from "@/components/forms";

export const metadata = { title: "Billing methods" };

export default async function BillingMethodsPage({
  searchParams,
}: {
  searchParams: Promise<{ gateway?: string; session_id?: string }>;
}) {
  const user = await requireUser();
  const t = await getT();
  const { gateway, session_id } = await searchParams;

  // returning from a hosted card-setup flow
  let setupResult: boolean | null = null;
  if (gateway && session_id) {
    setupResult = await completePaymentMethodSetup(user.id, gateway, session_id);
  }

  const [methods, gateways] = await Promise.all([
    db.storedPaymentMethod.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    }),
    storableGateways(),
  ]);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold">{t("billing.title")}</h1>
      <p className="mt-1 text-sm text-slate-500">
        {t("billing.subtitle")}
      </p>

      {setupResult === true && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Payment method saved. Future invoices will be charged automatically.
        </div>
      )}
      {setupResult === false && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          We couldn&apos;t verify the card setup. Please try again.
        </div>
      )}

      <div className="card mt-6 divide-y divide-slate-100">
        {methods.map((method) => (
          <div
            key={method.id}
            className="flex items-center justify-between p-5"
          >
            <div>
              <p className="font-medium capitalize">
                {method.brand ?? method.gateway} •••• {method.last4 ?? "????"}
                {method.isDefault && (
                  <span className="badge ml-2 bg-brand-100 text-brand-700">
                    {t("billing.default")}
                  </span>
                )}
              </p>
              <p className="text-sm text-slate-500">
                {method.expMonth && method.expYear
                  ? `${t("billing.expires")} ${String(method.expMonth).padStart(2, "0")}/${method.expYear}`
                  : method.gateway}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {!method.isDefault && (
                <form action={makeMethodDefault}>
                  <input type="hidden" name="id" value={method.id} />
                  <button
                    type="submit"
                    className="text-sm text-brand-600 hover:underline"
                  >
                    {t("billing.makeDefault")}
                  </button>
                </form>
              )}
              <form action={removeStoredMethod}>
                <input type="hidden" name="id" value={method.id} />
                <button
                  type="submit"
                  className="text-sm text-red-600 hover:underline"
                >
                  {t("billing.remove")}
                </button>
              </form>
            </div>
          </div>
        ))}
        {methods.length === 0 && (
          <p className="p-8 text-center text-sm text-slate-400">
            {t("billing.empty")}
          </p>
        )}
      </div>

      <div className="mt-6 flex gap-3">
        {gateways.map((g) => (
          <form key={g.slug} action={beginCardSetup}>
            <input type="hidden" name="gateway" value={g.slug} />
            <SubmitButton className="btn-primary">
              {t("billing.addCard")} {g.name}
            </SubmitButton>
          </form>
        ))}
        {gateways.length === 0 && (
          <p className="text-sm text-slate-400">
            No gateway with stored-card support is enabled. Enable Stripe in
            the admin panel.
          </p>
        )}
      </div>
    </div>
  );
}
