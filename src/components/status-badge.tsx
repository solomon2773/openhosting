const STYLES: Record<string, string> = {
  // services
  PENDING: "bg-amber-100 text-amber-700",
  ACTIVE: "bg-green-100 text-green-700",
  SUSPENDED: "bg-orange-100 text-orange-700",
  CANCELLED: "bg-slate-100 text-slate-500",
  EXPIRED: "bg-slate-100 text-slate-500",
  // invoices
  PAID: "bg-green-100 text-green-700",
  REFUNDED: "bg-purple-100 text-purple-700",
  // tickets
  OPEN: "bg-blue-100 text-blue-700",
  ANSWERED: "bg-green-100 text-green-700",
  CUSTOMER_REPLY: "bg-amber-100 text-amber-700",
  CLOSED: "bg-slate-100 text-slate-500",
  // priorities
  LOW: "bg-slate-100 text-slate-600",
  MEDIUM: "bg-amber-100 text-amber-700",
  HIGH: "bg-red-100 text-red-700",
  // payments
  COMPLETED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${STYLES[status] ?? "bg-slate-100 text-slate-600"}`}>
      {status.replace(/_/g, " ").toLowerCase()}
    </span>
  );
}
