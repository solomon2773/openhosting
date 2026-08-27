import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { TestProject } from "vitest/node";

let postgres: StartedPostgreSqlContainer | undefined;

export async function setup(project: TestProject): Promise<void> {
  postgres = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("openhosting_test")
    .withUsername("openhosting")
    .withPassword("openhosting")
    .start();

  const databaseUrl = postgres.getConnectionUri();
  const prismaCli = resolve("node_modules/prisma/build/index.js");
  const migration = spawnSync(
    process.execPath,
    [prismaCli, "migrate", "deploy"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        DIRECT_URL: databaseUrl,
      },
      encoding: "utf8",
    },
  );

  if (migration.status !== 0) {
    await postgres.stop();
    postgres = undefined;
    throw new Error(
      `Failed to apply test database migrations:\n${migration.stdout}\n${migration.stderr}`,
    );
  }

  project.provide("databaseUrl", databaseUrl);
}

export async function teardown(): Promise<void> {
  await postgres?.stop();
  postgres = undefined;
}

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}
