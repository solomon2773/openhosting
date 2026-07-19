# Migrating from another billing panel

OpenHosting ships importers that copy your data straight out of a previous
panel's MySQL database. Both are idempotent — rows that already exist
(matched by email/slug) are skipped, so re-running after a partial import is
safe.

## What is imported

- **Customers** — including bcrypt password hashes, so existing users keep
  their passwords and log in unchanged (credit balances too, where the
  source tracks them)
- **Categories/groups and products** — with billing-cycle pricing where the
  source provides it
- **Open tickets** — with full message history

Historical orders and invoices are intentionally left in your previous
system of record, and gateway credentials should always be re-entered fresh
under **Admin → Extensions**.

## WHMCS

```bash
npm run db:push && npm run db:seed          # set up OpenHosting first
WHMCS_DB_URL="mysql://user:secret@old-host:3306/whmcs" npm run import:whmcs
```

## Paymenter

```bash
npm run db:push && npm run db:seed
PAYMENTER_DB_URL="mysql://user:secret@old-host:3306/paymenter" npm run import:paymenter
```

## After importing

1. Review products and add any billing cycles or configurable options the
   importer couldn't map.
2. Configure payment gateways and server integrations under
   **Admin → Extensions**.
3. Point your storefront domain at OpenHosting and update the public URL in
   **Admin → Settings**.
