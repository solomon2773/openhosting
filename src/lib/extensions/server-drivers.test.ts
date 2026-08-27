import { describe, expect, test } from "vitest";
import { SERVER_DRIVERS } from "@/lib/extensions/registry";

describe("server driver registry", () => {
  test("registers 27 uniquely named drivers", () => {
    expect(SERVER_DRIVERS).toHaveLength(27);
    expect(new Set(SERVER_DRIVERS.map((driver) => driver.slug)).size).toBe(27);
    expect(new Set(SERVER_DRIVERS.map((driver) => driver.name)).size).toBe(27);
  });

  test.each(SERVER_DRIVERS)("$slug exposes a complete lifecycle", (driver) => {
    expect(driver.slug).toMatch(/^[a-z0-9-]+$/);
    expect(driver.name.trim()).not.toBe("");
    expect(driver.create).toBeTypeOf("function");
    expect(driver.suspend).toBeTypeOf("function");
    expect(driver.unsuspend).toBeTypeOf("function");
    expect(driver.terminate).toBeTypeOf("function");
  });

  test.each(SERVER_DRIVERS)("$slug has valid configuration fields", (driver) => {
    for (const fields of [driver.configFields, driver.productConfigFields]) {
      expect(new Set(fields.map((field) => field.key)).size).toBe(fields.length);
      for (const field of fields) {
        expect(field.key).toMatch(/^[a-z0-9_]+$/);
        expect(field.label.trim()).not.toBe("");
        if (field.type === "select") {
          expect(field.options?.length).toBeGreaterThan(0);
        }
      }
    }
  });
});
