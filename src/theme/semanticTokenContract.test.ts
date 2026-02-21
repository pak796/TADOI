import { describe, expect, it } from "bun:test";
import { THEMES } from "./themes";
import {
  RUNTIME_THEME_ALIAS_TO_TOKEN,
  USER_THEME_ROLE_CONTRACT,
  runtimeThemeFromContract
} from "./semanticTokenContract";

describe("semantic token contract", () => {
  it("maps warning and danger runtime aliases to distinct internal tokens", () => {
    expect(RUNTIME_THEME_ALIAS_TO_TOKEN.warn).toBe("warn");
    expect(RUNTIME_THEME_ALIAS_TO_TOKEN.danger).toBe("danger");
    expect(RUNTIME_THEME_ALIAS_TO_TOKEN.dueSoon).toBe("warn");
  });

  it("maps runtime aliases through the contract with deterministic values", () => {
    const runtime = runtimeThemeFromContract(THEMES.default);
    expect(runtime.warn).toBe(THEMES.default.warn);
    expect(runtime.danger).toBe(THEMES.default.danger);
    expect(runtime.selectionBg).toBe(THEMES.default.selectionBg);
    expect(runtime.selectionText).toBe(THEMES.default.selectionText);
  });

  it("keeps every internal token covered by at least one user-facing role", () => {
    const covered = new Set<string>();
    for (const role of Object.values(USER_THEME_ROLE_CONTRACT)) {
      role.internalTokens.forEach((token) => covered.add(token));
    }
    expect(Array.from(covered).sort()).toEqual(
      [
        "accent",
        "accent2",
        "bg",
        "border",
        "danger",
        "mutedText",
        "ok",
        "panel",
        "selectionBg",
        "selectionText",
        "text",
        "warn"
      ].sort()
    );
  });

  it("keeps user-facing roles anchored to runtime consumers", () => {
    for (const role of Object.values(USER_THEME_ROLE_CONTRACT)) {
      expect(role.runtimeAliases.length).toBeGreaterThan(0);
      expect(role.consumerExamples.length).toBeGreaterThan(0);
    }
  });
});
