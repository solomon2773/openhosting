# Accounts & security

## Registration & login

Customers register with name, email and password. Registration can be disabled
entirely (**Admin → Settings → Allow new registrations**) or gated behind email
verification and [captcha](#captcha). Passwords are hashed with bcrypt.

## Email verification

Enable **"Require email verification"** to email a confirmation link on signup.
You can additionally require a verified email before ordering — see
[Fraud protection](fraud.md#email-verification-gate).

## Password reset

Customers reset a forgotten password via an emailed one-time link. Reset tokens
are stored as SHA-256 hashes and expire after 60 minutes; resetting revokes all
existing sessions.

## Two-factor authentication (2FA)

Customers enable TOTP two-factor auth under **Account**:

1. They scan a QR code into an authenticator app (Google Authenticator, Aegis,
   1Password…).
2. They confirm with a 6-digit code to activate it.

Once enabled, login requires the code. Verification tolerates ±1 time step for
clock drift and uses constant-time comparison. Disabling 2FA requires the
account password.

## Captcha

OpenHosting supports [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/)
on the registration form and optionally at checkout. Add your site and secret
keys under **Admin → Settings → Security**; the widget only appears once a site
key is set, and the server verifies the token.

## Staff roles (RBAC)

Any user with a **role** is staff and can access the admin panel. Roles have a
permission list; `*` grants everything, otherwise each admin area checks a
specific permission (e.g. `products`, `invoices`, `tickets`, `fraud`,
`affiliates`, `settings`). Create roles and assign them under
**Admin → Users**. The seed ships an **Administrator** role (`*`) and a
**Support** role (tickets + users).

## Sessions

Sessions are opaque IDs stored server-side with a 14-day lifetime; the cookie is
`httpOnly` and `SameSite=Lax`. Sessions are revoked on password reset.

## Audit log

Sensitive actions — logins, admin changes, fraud decisions, provisioning
failures — are recorded in the audit log (**Admin → Audit log**) with the actor,
action, target and client IP.

## API access

Programmatic access uses scoped [API keys](../api/rest-api.md) and an
[OAuth2 provider](../api/oauth.md) for signing users into other applications —
both separate from customer passwords.
