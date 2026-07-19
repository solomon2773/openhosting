import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { StatusBadge } from "@/components/status-badge";
import { TicketThread } from "@/components/ticket-thread";

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const ticket = await db.ticket.findUnique({
    where: { id },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: { user: true, attachments: true },
      },
    },
  });
  if (!ticket || ticket.userId !== user.id) notFound();

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{ticket.subject}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Ticket #{ticket.number} · {ticket.department}
          </p>
        </div>
        <div className="flex gap-2">
          <StatusBadge status={ticket.priority} />
          <StatusBadge status={ticket.status} />
        </div>
      </div>
      <TicketThread ticket={ticket} viewerId={user.id} />
    </div>
  );
}
