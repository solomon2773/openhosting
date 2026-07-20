# Using Supabase

OpenHosting works with any PostgreSQL, including Supabase's managed Postgres.

1. Create a project at [supabase.com](https://supabase.com).
2. Open **Project Settings → Database → Connection string** and copy both
   connection strings:
   - **Transaction pooler** (port `6543`) → `DATABASE_URL`, with
     `?pgbouncer=true` appended
   - **Session / direct** (port `5432`) → `DIRECT_URL`

```dotenv
DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"
```

3. Apply the schema and seed:

```bash
npm run db:migrate   # applies prisma/migrations via DIRECT_URL
npm run db:seed
```

## Why two URLs

At runtime the app talks to Postgres through the Prisma **pg driver adapter**
using `DATABASE_URL` — point this at the pooled connection so serverless and
autoscaled deployments don't exhaust connections. Migrations need a direct
connection (PgBouncer's transaction mode can't run them), so the CLI uses
`DIRECT_URL`.

## Notes

- OpenHosting keeps its own `users` table and session-based auth, so **no
  Supabase Auth configuration is needed** — Supabase is only the data layer.
- Supabase handles backups, point-in-time recovery and scaling for you.
- Deploy the app container anywhere ([Docker](docker.md), [Kubernetes](kubernetes.md),
  a PaaS) with those two variables set.
