import { describe, expect, test } from "vitest";
import {
  isColorModePreference,
  resolveColorMode,
} from "@/lib/color-mode";

describe("color mode", () => {
  test("uses the operating-system preference in system mode", () => {
    expect(resolveColorMode("system", true)).toBe("dark");
    expect(resolveColorMode("system", false)).toBe("light");
  });

  test("keeps an explicit user override", () => {
    expect(resolveColorMode("light", true)).toBe("light");
    expect(resolveColorMode("dark", false)).toBe("dark");
  });

  test("rejects invalid persisted values", () => {
    expect(isColorModePreference("system")).toBe(true);
    expect(isColorModePreference("sepia")).toBe(false);
    expect(isColorModePreference(null)).toBe(false);
  });
});
