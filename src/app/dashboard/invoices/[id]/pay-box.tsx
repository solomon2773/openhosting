"use client";

import { useActionState } from "react";
import { payInvoice } from "@/lib/actions/client";
import { SubmitButton } from "@/components/forms";

export function PayBox({
  invoiceId,
  gateways,
  credits,
  total,
  currency,
}: {
  invoiceId: string;
  gateways: { slug: string; name: string }[];
  credits: number;
  total: number;
  currency: string;
}) {
  const [state, formAction] = useActionState(payInvoice, null);
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);

  const methods = [
    ...gateways.map((g) => ({ value: g.slug, label: g.name })),
    ...(credits >= total && total > 0
      ? [{ value: "credits", label: `Account credit (${fmt(credits)})` }]
      : []),
  ];

  if (methods.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No payment methods are enabled. Please contact support.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      {state?.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}
      {state?.success && (
        <div
          className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800"
          // gateway-provided payment instructions (e.g. bank transfer details)
          dangerouslySetInnerHTML={{ __html: state.success }}
        />
      )}
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <select name="method" className="input" defaultValue={methods[0]?.value}>
        {methods.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
      <SubmitButton className="btn-primary w-full">
        Pay {fmt(total)}
      </SubmitButton>
    </form>
  );
}
