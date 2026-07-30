# Support tickets

OpenHosting includes a built-in support desk so customers can reach you without
a separate helpdesk tool.

## For customers

Customers open tickets from the client area with:

- **Subject**
- **Department** — general, billing, technical, or sales
- **Priority** — low, medium, or high
- **Message** and optional **attachments**

They then see the full conversation thread and can reply or close the ticket.

## For staff

Under **Admin → Tickets** staff see every ticket sorted by status and activity.
Opening a ticket lets you:

- **Reply** — your message is marked as staff and emails the customer
- **Change status** — open, answered, customer reply, closed
- **Assign** — hand the ticket to a specific staff member

## AI assistance

Staff can have a reply drafted from your published knowledgebase, and new tickets
can be classified into a department and priority automatically. Both are off by
default and need your own model API key — see [AI support](ai-support.md).

## Statuses

| Status | Meaning |
|---|---|
| Open | New, awaiting first staff reply |
| Answered | Staff replied last |
| Customer reply | Customer replied since the last staff answer |
| Closed | Resolved |

## Attachments

Both customers and staff can attach files (up to 3 per message, 5 MB each).
Allowed types include images, PDF, plain text, ZIP and JSON. Files are stored in
the database and served through an authenticated download route — only the
ticket owner and staff can fetch them.

## Notifications

When staff reply, the customer gets an in-app notification and (if enabled) an
email. Customers control which events notify them under
**Account → Notifications**. See [Notifications](notifications.md).

## Email templates

The ticket-reply email uses the `ticket_reply` template, editable under
**Admin → Email templates**.
