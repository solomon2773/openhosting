import { createTicket } from "@/lib/actions/client";
import { ActionForm, SubmitButton } from "@/components/forms";

export const metadata = { title: "New ticket" };

export default function NewTicketPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold">Open a support ticket</h1>
      <div className="card mt-6 p-6">
        <ActionForm action={createTicket}>
          <div>
            <label className="label" htmlFor="subject">
              Subject
            </label>
            <input id="subject" name="subject" required className="input" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="department">
                Department
              </label>
              <select id="department" name="department" className="input">
                <option value="general">General</option>
                <option value="billing">Billing</option>
                <option value="technical">Technical support</option>
                <option value="sales">Sales</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="priority">
                Priority
              </label>
              <select
                id="priority"
                name="priority"
                className="input"
                defaultValue="MEDIUM"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="message">
              Message
            </label>
            <textarea
              id="message"
              name="message"
              rows={6}
              required
              className="input"
              placeholder="Describe your issue…"
            />
          </div>
          <SubmitButton className="btn-primary">Submit ticket</SubmitButton>
        </ActionForm>
      </div>
    </div>
  );
}
