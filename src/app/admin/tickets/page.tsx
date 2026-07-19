import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";

export const metadata = { title: "Tickets" };

export default async function AdminTicketsPage() {
  await requireAdmin("tickets");
  const tickets = await db.ticket.findMany({
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: 100,
    include: { user: true, assignedTo: true },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">Support tickets</h1>
      <div className="card mt-6">
        <table className="table-base">
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Subject</th>
              <th>Customer</th>
              <th>Assigned</th>
              <th>Priority</th>
              <th>Updated</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr key={ticket.id}>
                <td>#{ticket.number}</td>
                <td>
                  <Link
                    href={`/admin/tickets/${ticket.id}`}
                    className="font-medium text-brand-600 hover:underline"
                  >
                    {ticket.subject}
                  </Link>
                </td>
                <td>
                  {ticket.user.firstName} {ticket.user.lastName}
                </td>
                <td>
                  {ticket.assignedTo
                    ? `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}`
                    : "—"}
                </td>
                <td>
                  <StatusBadge status={ticket.priority} />
                </td>
                <td>{formatDateTime(ticket.updatedAt)}</td>
                <td>
                  <StatusBadge status={ticket.status} />
                </td>
              </tr>
            ))}
            {tickets.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400">
                  No tickets.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
