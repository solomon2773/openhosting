"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { askCustomerAssistant } from "@/lib/actions/assistant";
import { createTicket } from "@/lib/actions/client";
import { ActionForm } from "@/components/forms";

type Message = { role: "user" | "assistant"; content: string };

function AskButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary shrink-0">
      {pending ? "Thinking…" : "Ask"}
    </button>
  );
}

export function CustomerAssistant() {
  const [state, action] = useActionState(askCustomerAssistant, null);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const handledResponse = useRef<string | null>(null);

  useEffect(() => {
    if (!state?.id || handledResponse.current === state.id) return;
    handledResponse.current = state.id;
    setMessages((current) => [
      ...current,
      { role: "user", content: state.question },
      { role: "assistant", content: state.answer },
    ]);
    setQuestion("");
  }, [state]);

  const transcript = messages.length
    ? messages
        .map(
          (message) =>
            `${message.role === "user" ? "Customer" : "Assistant"}: ${message.content}`,
        )
        .join("\n\n")
    : "Customer requested help from the read-only assistant and asked to escalate to support.";
  const lastQuestion = [...messages]
    .reverse()
    .find((message) => message.role === "user")?.content;

  return (
    <div className="space-y-5">
      <div className="card min-h-72 space-y-4 p-5" aria-live="polite">
        {messages.length === 0 && (
          <div className="mx-auto max-w-xl py-16 text-center">
            <p className="font-medium">How can I help?</p>
            <p className="mt-2 text-sm text-slate-500">
              I can explain published documentation and summarize your services
              or invoices. I cannot change your account or operate a service.
            </p>
          </div>
        )}
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`max-w-2xl rounded-xl px-4 py-3 text-sm whitespace-pre-wrap ${
              message.role === "user"
                ? "ml-auto bg-brand-600 text-white"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            {message.content}
          </div>
        ))}
      </div>

      {state?.error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <form action={action} className="flex items-end gap-3">
        <input
          type="hidden"
          name="history"
          value={JSON.stringify(messages.slice(-10))}
        />
        <label className="flex-1">
          <span className="label">Your question</span>
          <textarea
            name="question"
            rows={2}
            minLength={3}
            maxLength={2_000}
            required
            className="input resize-y"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Why is invoice #123 still pending?"
          />
        </label>
        <AskButton />
      </form>

      <div className="card flex flex-wrap items-center justify-between gap-4 p-4">
        <div>
          <p className="text-sm font-medium">Need a person or an account change?</p>
          <p className="text-xs text-slate-500">
            Send this conversation to the support team as a new ticket.
          </p>
        </div>
        <ActionForm action={createTicket} className="m-0">
          <input type="hidden" name="subject" value={(lastQuestion ?? "AI assistant handoff").slice(0, 120)} />
          <input type="hidden" name="department" value="general" />
          <input type="hidden" name="priority" value="MEDIUM" />
          <input type="hidden" name="message" value={transcript.slice(0, 20_000)} />
          <button type="submit" className="btn-secondary">
            Escalate to ticket
          </button>
        </ActionForm>
      </div>
    </div>
  );
}
