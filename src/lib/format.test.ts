import { describe, expect, test } from "vitest";
import { formatMoney } from "@/lib/format";

describe("formatMoney", () => {
  test("formats ISO fiat currencies with Intl currency rules", () => {
    expect(formatMoney(12.5, "USD")).toBe("$12.50");
  });

  test("formats USDC without treating it as an ISO 4217 code", () => {
    expect(formatMoney(12.123456, "USDC")).toBe("12.123456 USDC");
    expect(formatMoney(12, "USDC")).toBe("12.00 USDC");
  });
});
