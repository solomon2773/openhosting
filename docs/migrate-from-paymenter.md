# Migrating from Paymenter

OpenHosting ships an importer that copies data straight out of a Paymenter
(v1) MySQL database.

## What is imported

- **Users** — including bcrypt password hashes, so existing customers keep
  their passwords and log in unchanged
- **Categories and products** — with their monthly price when present
- **Open tickets** — with full message history

Orders, invoices and gateway configuration are intentionally not imported:
historical invoices belong to your accounting system of record, and gateway
credentials should be re-entered fresh under **Admin → Extensions**.

## Steps

```bash
# 1. Set up OpenHosting (schema + admin), see the README quick start
npm run db:push && npm run db:seed

# 2. Run the importer against your Paymenter MySQL database
PAYMENTER_DB_URL="mysql://paymenter:secret@old-host:3306/paymenter" \
  npm run import:paymenter
```

The importer is idempotent — rows already present (matched by email/slug) are
skipped, so it is safe to re-run after a dry run or partial import.

## After importing

1. Recreate billing cycles/prices beyond monthly on the product pages.
2. Configure gateways and the Pterodactyl integration under
   **Admin → Extensions**.
3. Point your storefront domain at OpenHosting and update the public URL in
   **Admin → Settings**.
