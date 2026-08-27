export const COLOR_MODE_STORAGE_KEY = "openhosting-color-mode";

export const COLOR_MODE_PREFERENCES = ["system", "light", "dark"] as const;

export type ColorModePreference = (typeof COLOR_MODE_PREFERENCES)[number];
export type ResolvedColorMode = Exclude<ColorModePreference, "system">;

export function isColorModePreference(
  value: string | null,
): value is ColorModePreference {
  return COLOR_MODE_PREFERENCES.some((preference) => preference === value);
}

export function resolveColorMode(
  preference: ColorModePreference,
  systemPrefersDark: boolean,
): ResolvedColorMode {
  return preference === "system"
    ? systemPrefersDark
      ? "dark"
      : "light"
    : preference;
}
