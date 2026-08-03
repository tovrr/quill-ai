import { describe, expect, it } from "vitest";
import { nextThemeMode, resolveThemeMode, THEME_CYCLE } from "@/lib/theme";

describe("theme cycle", () => {
  it("follows system → light → dark → system", () => {
    expect(nextThemeMode("system")).toBe("light");
    expect(nextThemeMode("light")).toBe("dark");
    expect(nextThemeMode("dark")).toBe("system");
  });

  it("handles an unknown value by falling back to system", () => {
    // Cast to bypass the type check on purpose.
    expect(nextThemeMode("hot-pink" as never)).toBe("system");
  });

  it("covers exactly three modes in its cycle", () => {
    expect(THEME_CYCLE).toEqual(["system", "light", "dark"]);
  });
});

describe("resolveThemeMode", () => {
  it("respects explicit choices", () => {
    expect(resolveThemeMode("light", true)).toBe("light");
    expect(resolveThemeMode("light", false)).toBe("light");
    expect(resolveThemeMode("dark", true)).toBe("dark");
    expect(resolveThemeMode("dark", false)).toBe("dark");
  });

  it("defers to system preference when theme is 'system'", () => {
    expect(resolveThemeMode("system", true)).toBe("dark");
    expect(resolveThemeMode("system", false)).toBe("light");
  });
});
