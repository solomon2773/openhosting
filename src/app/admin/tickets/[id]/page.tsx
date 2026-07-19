import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { StatusBadge } from "@/components/status-badge";
import { TicketThread } from "@/components/ticket-thread";
import { adminUpdateTicket } from "@/lib/actions/admin";

export default async function AdminTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireAdmin("tickets");
  const { id } = await params;
  const [ticket, staff] = await Promise.all([
    db.ticket.findUnique({
      where: { id },
      include: {
        user: true,
        messages: {
          orderBy: { createdAt: "asc" },
          include: { user: true, attachments: true },
        },
      },
    }),
    db.user.findMany({ where: { roleId: { not: null } } }),
  ]);
  if (!ticket) notFound();

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{ticket.subject}</h1>
          <p className="mt-1 text-sm text-slate-500">
            #{ticket.number} · {ticket.department} ·{" "}
            <Link
              href={`/admin/users/${ticket.userId}`}
              className="text-brand-600 hover:underline"
            >
              {ticket.user.firstName} {ticket.user.lastName}
            </Link>
          </p>
        </div>
        <div className="flex gap-2">
          <StatusBadge status={ticket.priority} />
          <StatusBadge status={ticket.status} />
        </div>
      </div>

      <form
        action={adminUpdateTicket}
        className="card mb-6 flex flex-wrap items-end gap-3 p-4"
      >
        <input type="hidden" name="id" value={ticket.id} />
        <div>
          <label className="label">Status</label>
          <select name="status" defaultValue={ticket.status} className="input">
            <option value="OPEN">Open</option>
            <option value="ANSWERED">Answered</option>
            <option value="CUSTOMER_REPLY">Customer reply</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
        <div>
          <label className="label">Assigned to</label>
          <select
            name="assignedToId"
            defaultValue={ticket.assignedToId ?? ""}
            className="input"
          >
            <option value="">Unassigned</option>
            {staff.map((member) => (
              <option key={member.id} value={member.id}>
                {member.firstName} {member.lastName}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-secondary">
          Update
        </button>
      </form>

      <TicketThread ticket={ticket} viewerId={admin.id} />
    </div>
  );
}
