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

Staff who are locked out — no mail configured yet, or a lost authenticator —
are recovered from the server instead: re-run the installer and pick **Reset the
admin password**, or run the same tool by hand:

```bash
printf '%s' 'a-strong-password' | docker compose exec -T app \
  node prisma/reset-admin.mjs --email you@example.com --password-stdin --disable-2fa
```

It revokes that account's sessions and pending reset links and writes an
`auth.password_reset` entry to the audit log. See
[Docker](../getting-started/docker.md#resetting-the-admin-password).

## Sign-in throttling

Failed sign-ins are counted per account **and** per client address, so a
password cannot be guessed at HTTP speed. Once either budget is spent, further
attempts are refused for the lockout period with *"Too many failed sign-in
attempts. Try again in N minutes"* — the correct password included.

| Setting | Default | Meaning |
|---|---|---|
| Failed sign-ins before an account is locked | 5 | Per email address; `0` disables |
| Failed sign-ins from one IP before it is locked | 20 | Across all accounts from that address; `0` disables |
| Lockout duration (minutes) | 15 | How long the lock lasts, and the window failures are counted over |

Details worth knowing:

- **The 2FA step spends the same budget.** Guessing a six-digit code is cheap,
  so codes are throttled exactly like passwords.
- **The check runs before the account is looked up**, so an address that does
  not exist behaves identically to one that does — the lockout message cannot
  be used to discover which emails have accounts.
- **Attempts made while locked out are not recorded**, so nobody can keep
  somebody else's account locked out indefinitely by continuing to try. The
  lock always expires on its own.
- **A successful sign-in clears the account's counter.**
- Blocked attempts are audited as `auth.login_blocked`; failures remain
  `auth.login_failed`. Records are pruned by the hourly
  [cron tick](../billing/automation.md).

## Two-factor authentication (2FA)

Customers enable TOTP two-factor auth under **Account**:

1. They scan a QR code into an authenticator app (Google Authenticator, Aegis,
   1Password…).
2. They confirm with a 6-digit code to activate it.

Once enabled, login requires the code. Verification tolerates ±1 time step for
clock drift and uses constant-time comparison. Disabling 2FA requires the
account password.

### Requiring it for staff

**Admin → Settings → Security → Require two-factor authentication for staff**
makes 2FA mandatory for every account that holds a [role](#staff-roles-rbac).
While it is on:

- Staff without 2FA are sent to their account page — with an explanation —
  instead of into the admin panel. The rule is enforced in the same guard every
  admin page and server action passes through, so there is no route around it.
- Staff cannot turn their own 2FA off; the option is refused while the
  requirement stands.
- Customers are unaffected — 2FA stays optional for accounts without a role.

Turning it on does not lock anyone out permanently: staff keep normal client-area
access and enable 2FA there, then the admin panel opens again. If an
authenticator is lost, clear it from the server with
[`reset-admin`](../getting-started/docker.md#resetting-the-admin-password)
(`--disable-2fa`), which requires shell access to the host.

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
