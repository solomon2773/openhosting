import { afterAll, beforeEach, expect, test } from "vitest";
import { db } from "@/lib/db";

beforeEach(async () => {
  await db.currency.deleteMany();
});

afterAll(async () => {
  await db.$disconnect();
});

test("applies the complete schema to a disposable PostgreSQL database", async () => {
  const [result] = await db.$queryRaw<Array<{ value: number }>>`SELECT 1 AS value`;
  const currencyCount = await db.currency.count();

  expect(result.value).toBe(1);
  expect(currencyCount).toBe(0);
});
