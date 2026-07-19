import { defineConfig, env } from "prisma/config";

// Prisma 7 no longer auto-loads .env; do it here for local CLI usage.
try {
  process.loadEnvFile(".env");
} catch {
  // no .env in CI/containers — env vars come from the environment
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // CLI (migrate/db push) prefers the direct connection; the runtime
    // client uses the pooled DATABASE_URL via the pg driver adapter.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
