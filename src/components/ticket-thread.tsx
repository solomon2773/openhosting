import { formatDateTime } from "@/lib/format";
import { closeTicket, replyTicket } from "@/lib/actions/client";
import { ActionForm, SubmitButton } from "@/components/forms";
import type { Ticket, TicketMessage, User } from "@prisma/client";

type Attachment = { id: string; filename: string; size: number };
type ThreadTicket = Ticket & {
  messages: (TicketMessage & {
    user: User & { roleId?: string | null };
    attachments?: Attachment[];
  })[];
};

// Shared between the client area and the admin panel.
export function TicketThread({
  ticket,
  viewerId,
}: {
  ticket: ThreadTicket;
  viewerId: string;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {ticket.messages.map((message) => {
          const isStaff = Boolean(message.user.roleId);
          const isViewer = message.userId === viewerId;
          return (
            <div
              key={message.id}
              className={`card p-5 ${isStaff ? "border-brand-200 bg-brand-50/50" : ""}`}
            >
              <div className="mb-2 flex items-center justify-between text-sm">
                <p className="font-medium">
                  {message.user.firstName} {message.user.lastName}
                  {isStaff && (
                    <span className="badge ml-2 bg-brand-100 text-brand-700">
                      Staff
                    </span>
                  )}
                  {isViewer && !isStaff && (
                    <span className="ml-2 text-xs text-slate-400">(you)</span>
                  )}
                </p>
                <p className="text-slate-400">
                  {formatDateTime(message.createdAt)}
                </p>
              </div>
              <p className="text-sm whitespace-pre-line text-slate-700">
                {message.message}
              </p>
              {(message.attachments?.length ?? 0) > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {message.attachments!.map((attachment) => (
                    <li key={attachment.id}>
                      <a
                        href={`/api/attachments/${attachment.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-brand-600 hover:underline"
                      >
                        📎 {attachment.filename}
                        <span className="text-slate-400">
                          ({Math.ceil(attachment.size / 1024)} KB)
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {ticket.status !== "CLOSED" ? (
        <div className="card p-5">
          <h2 className="mb-3 font-semibold">Reply</h2>
          <ActionForm action={replyTicket}>
            <input type="hidden" name="ticketId" value={ticket.id} />
            <textarea
              name="message"
              rows={4}
              required
              className="input"
              placeholder="Write your reply…"
            />
            <div>
              <label className="label" htmlFor="attachments">
                Attachments (up to 3 files, 5 MB each)
              </label>
              <input
                id="attachments"
                name="attachments"
                type="file"
                multiple
                className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm"
              />
            </div>
            <div className="flex gap-3">
              <SubmitButton className="btn-primary">Send reply</SubmitButton>
            </div>
          </ActionForm>
          <ActionForm action={closeTicket} className="mt-3">
            <input type="hidden" name="ticketId" value={ticket.id} />
            <button
              type="submit"
              className="text-sm text-slate-500 hover:text-red-600"
            >
              Close this ticket
            </button>
          </ActionForm>
        </div>
      ) : (
        <p className="text-center text-sm text-slate-400">
          This ticket is closed.
        </p>
      )}
    </div>
  );
}
