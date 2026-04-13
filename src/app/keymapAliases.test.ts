import { describe, expect, it } from "bun:test";
import {
  getAliasTokensForAction,
  keyInputToAliasTokens,
  normalizeKeymapAliases,
  resolveAliasActionIdForInput,
  resolveKeymapAliases,
} from "./keymapAliases";

describe("keymapAliases", () => {
  it("normalizes only supported contexts/actions and valid tokens", () => {
    const normalized = normalizeKeymapAliases({
      list: {
        list_open_search: ["/", "ctrl+f", "bad-token", "Ctrl+F"],
        list_jump_bottom: ["G"],
        dashboard_open_help: ["?"],
      },
      help: {
        help_close: ["Esc", "escape"],
      },
      unknown_context: {
        list_open_search: ["/"],
      },
    });

    expect(normalized).toEqual({
      list: {
        list_open_search: ["/", "Ctrl+F"],
        list_jump_bottom: ["G"],
      },
      help: {
        help_close: ["Esc"],
      },
    });
  });

  it("returns undefined when no valid aliases survive normalization", () => {
    const normalized = normalizeKeymapAliases({
      list: {
        not_real_action: ["whatever"],
      },
    });
    expect(normalized).toBeUndefined();
  });

  it("captures deterministic first-wins conflict warnings per context", () => {
    const normalized = normalizeKeymapAliases({
      list: {
        list_open_search: ["/"],
        list_open_tag_panel: ["/", "p"],
      },
    });
    const resolved = resolveKeymapAliases(normalized);

    expect(resolved.byContext.list?.tokenToAction["/"]).toBe(
      "list_open_search",
    );
    expect(resolved.byContext.list?.tokenToAction.p).toBe(
      "list_open_tag_panel",
    );
    expect(resolved.warnings).toEqual([
      '[list] token "/" kept for "list_open_search", ignored for "list_open_tag_panel".',
    ]);
  });

  it("maps key input to alias tokens with ctrl precedence", () => {
    expect(
      keyInputToAliasTokens({
        name: "s",
        sequence: "s",
        ctrl: true,
        shift: false,
      }),
    ).toEqual(["Ctrl+S"]);
    expect(
      keyInputToAliasTokens({
        name: "up",
        sequence: "",
        ctrl: false,
        shift: false,
      }),
    ).toEqual(["ArrowUp"]);
    expect(
      keyInputToAliasTokens({
        name: "/",
        sequence: "?",
        ctrl: false,
        shift: true,
      }),
    ).toEqual(["?", "/"]);
  });

  it("resolves action aliases for matching context and key input", () => {
    const normalized = normalizeKeymapAliases({
      list: {
        list_open_search: ["Ctrl+F"],
        list_open_add: ["n"],
      },
    });
    const resolved = resolveKeymapAliases(normalized);

    expect(
      resolveAliasActionIdForInput(
        "list",
        { name: "f", sequence: "f", ctrl: true, shift: false },
        resolved,
      ),
    ).toBe("list_open_search");
    expect(
      resolveAliasActionIdForInput(
        "list",
        { name: "n", sequence: "n", ctrl: false, shift: false },
        resolved,
      ),
    ).toBe("list_open_add");
    expect(
      resolveAliasActionIdForInput(
        "dashboard",
        { name: "n", sequence: "n", ctrl: false, shift: false },
        resolved,
      ),
    ).toBeNull();
  });

  it("exposes configured alias tokens for hint rendering", () => {
    const normalized = normalizeKeymapAliases({
      help: {
        help_open_backup_center: ["9"],
      },
    });
    const resolved = resolveKeymapAliases(normalized);
    expect(
      getAliasTokensForAction("help", "help_open_backup_center", resolved),
    ).toEqual(["9"]);
  });
});
