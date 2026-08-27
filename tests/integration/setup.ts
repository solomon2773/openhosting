import { inject } from "vitest";

const databaseUrl = inject("databaseUrl");

process.env.DATABASE_URL = databaseUrl;
process.env.DIRECT_URL = databaseUrl;
