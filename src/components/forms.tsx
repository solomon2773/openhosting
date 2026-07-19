"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/lib/actions/auth";

export function SubmitButton({
  children,
  className = "btn-primary w-full",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? "Working…" : children}
    </button>
  );
}

export function Alert({ state }: { state: FormState }) {
  if (!state?.error && !state?.success) return null;
  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm ${
        state.error
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-green-200 bg-green-50 text-green-700"
      }`}
    >
      {state.error ?? state.success}
    </div>
  );
}

// Generic form bound to a server action returning FormState.
export function ActionForm({
  action,
  children,
  className = "space-y-4",
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      <Alert state={state} />
      {children}
    </form>
  );
}
