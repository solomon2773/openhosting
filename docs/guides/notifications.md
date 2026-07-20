# Notifications

OpenHosting notifies customers about billing and support events through two
channels — an in-app feed and email — with per-user, per-event preferences.

## In-app feed

A **Notifications** link in the client-area sidebar shows a feed with an unread
badge. Visiting the page marks everything read. Notifications link to the
relevant invoice, service or ticket.

## Events

The system sends notifications for:

| Event | When |
|---|---|
| Invoice created | A new (renewal) invoice is issued |
| Payment received | An invoice is paid |
| Service activated | A service goes active and provisions |
| Service suspended | A service is suspended for non-payment |
| Ticket reply | Staff reply to the customer's ticket |

## Per-user preferences

Customers choose which events notify them, and on which channel, under
**Account → Notifications**. Each event has independent **Email** and **In-app**
toggles (both on by default).

## Email delivery & templates

Email notifications use the SMTP settings under **Admin → Settings → Email** and
the templates under **Admin → Email templates**. Templates support
`{{placeholder}}` substitution (e.g. `{{name}}`, `{{invoice}}`, `{{link}}`).
Every send is recorded in the email log as sent or failed, so you can diagnose
delivery problems.

## For developers

Notifications are dispatched through a single `notifyUser()` service that fans
out to both channels while honoring the user's preferences — see
`src/lib/services/notifications.ts`. Adding a new notification type is a matter
of adding it to `NOTIFICATION_TYPES` and calling `notifyUser()`.
