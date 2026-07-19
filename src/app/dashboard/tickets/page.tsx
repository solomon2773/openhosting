import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";

export const metadata = { title: "Support tickets" };

export default async function TicketsPage() {
  const user = await requireUser();
  const tickets = await db.ticket.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Support tickets</h1>
        <Link href="/dashboard/tickets/new" className="btn-primary">
          Open a ticket
        </Link>
      </div>
      <div className="card mt-6">
        <table className="table-base">
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Subject</th>
              <th>Priority</th>
              <th>Last updated</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr key={ticket.id}>
                <td>#{ticket.number}</td>
                <td>
                  <Link
                    href={`/dashboard/tickets/${ticket.id}`}
                    className="font-medium text-brand-600 hover:underline"
                  >
                    {ticket.subject}
                  </Link>
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
                <td colSpan={5} className="py-8 text-center text-slate-400">
                  No tickets yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
