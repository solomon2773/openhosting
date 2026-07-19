# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security reports. Email
muw0523@gmail.com with the details and steps to reproduce; you will get a
response within 72 hours. Coordinated disclosure is appreciated — we'll
credit you in the release notes unless you prefer otherwise.

## Supported versions

The latest release on `main` receives security fixes.

## Hardening checklist for operators

- Set a strong `CRON_SECRET` and database password; never expose Postgres
  publicly.
- Serve the app behind TLS and set the public URL in Admin → Settings.
- Change the seeded admin password immediately (or seed with
  `SEED_ADMIN_PASSWORD`).
- Enable TOTP two-factor authentication for all staff accounts.
- Scope API keys to the minimum permissions needed.
