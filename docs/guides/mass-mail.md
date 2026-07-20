# Mass mail

Mass mail sends an announcement email to a segment of your customers — for
maintenance notices, promotions, or policy changes.

## Sending

Under **Admin → Mass mail**:

1. Choose an **audience**:
   - **All customers**
   - **With an active service**
   - **No services**
   (each option shows its current recipient count)
2. Write a **subject** and **body** (HTML). Use `{{name}}` to personalize the
   greeting per recipient.
3. **Send**.

Delivery uses your [SMTP settings](../getting-started/configuration.md#email-smtp).
Each message is recorded in the email log, and the campaign (subject, audience,
sent count) is saved to the **history** on the same page.

## Notes

- Sending is synchronous — for very large lists, expect the request to take a
  while as each message goes out.
- Recipients are resolved at send time from the chosen segment.
- For transactional, per-event emails (invoices, tickets), use
  [Notifications](notifications.md) and email templates instead.
