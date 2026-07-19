# Using Supabase as the database

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

Prisma routes normal queries through the pooler (`DATABASE_URL`) — required
for serverless/edge-friendly connection counts — and uses `DIRECT_URL` only
for migrations, which PgBouncer's transaction mode can't run.

That's it: deploy the app container anywhere (Docker, k8s, Vercel) with those
two variables and Supabase handles backups, PITR and scaling for the data
layer. The app keeps its own `users` table and session auth, so no Supabase
Auth configuration is needed.
