"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Alert, SubmitButton } from "@/components/forms";
import { replyTicket } from "@/lib/actions/client";
import { draftTicketReplyAction } from "@/lib/actions/admin";
import type { FormState } from "@/lib/actions/auth";

/**
 * The staff reply form, with an AI draft button.
 *
 * One component owns both the button and the textarea so the draft is React
 * state rather than a value poked into the DOM — a server action re-renders the
 * tree, and an imperative write would be wiped by that re-render.
 *
 * The draft only ever fills the box. Sending stays a separate, deliberate click.
 */
function DraftButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-secondary text-sm">
      {pending ? "Drafting…" : "Draft with AI"}
    </button>
  );
}

export function AiReplyForm({
  ticketId,
  labels,
}: {
  ticketId: string;
  labels: { attachments: string; send: string };
}) {
  const [message, setMessage] = useState("");
  const [replyState, replyAction] = useActionState<FormState, FormData>(
    replyTicket,
    null,
  );
  // A plain form, so the button still works if it is clicked before hydration.
  const [draftState, draftAction] = useActionState<FormState, FormData>(
    draftTicketReplyAction,
    null,
  );

  useEffect(() => {
    if (draftState?.success) setMessage(draftState.success);
  }, [draftState]);

  // A sent reply leaves an empty box behind, as an uncontrolled form would.
  useEffect(() => {
    if (replyState?.success) setMessage("");
  }, [replyState]);

  return (
    <div>
      <form action={draftAction} className="mb-3 flex flex-wrap items-center gap-3">
        <input type="hidden" name="ticketId" value={ticketId} />
        <DraftButton />
        <span className="text-xs text-slate-400">
          Grounded in your published knowledgebase. Read it before sending.
        </span>
      </form>
      {draftState?.error && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {draftState.error}
        </p>
      )}
      <form action={replyAction} className="space-y-4">
        <Alert state={replyState} />
        <input type="hidden" name="ticketId" value={ticketId} />
        <textarea
          id="ticket-reply-body"
          name="message"
          rows={4}
          required
          className="input"
          placeholder="Write your reply…"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        <div>
          <label className="label" htmlFor="attachments">
            {labels.attachments}
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
          <SubmitButton className="btn-primary">{labels.send}</SubmitButton>
        </div>
      </form>
    </div>
  );
}
