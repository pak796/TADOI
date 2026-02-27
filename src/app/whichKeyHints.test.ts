import { describe, expect, it } from "bun:test";
import { FocusTarget, Mode } from "../domain/models";
import { normalizeKeymapAliases, resolveKeymapAliases } from "./keymapAliases";
import {
  buildLeftRailHintLines,
  buildWhichKeyHintItems,
  buildWhichKeyPrefixPopup,
  resolveWhichKeyContext
} from "./whichKeyHints";

describe("whichKeyHints", () => {
  it("maps mode/focus state to stable which-key contexts", () => {
    expect(
      resolveWhichKeyContext({
        mode: Mode.LIST,
        focus: FocusTarget.TASK_LIST,
        backupScreen: null
      })
    ).toBe("list");
    expect(
      resolveWhichKeyContext({
        mode: Mode.DASHBOARD,
        focus: FocusTarget.DASHBOARD,
        backupScreen: null
      })
    ).toBe("dashboard");
    expect(
      resolveWhichKeyContext({
        mode: Mode.BACKUP_CENTER,
        focus: FocusTarget.BACKUP_CENTER,
        backupScreen: "menu"
      })
    ).toBe("backup");
    expect(
      resolveWhichKeyContext({
        mode: Mode.HELP,
        focus: FocusTarget.TASK_LIST,
        backupScreen: null
      })
    ).toBe("help");
    expect(
      resolveWhichKeyContext({
        mode: Mode.MODAL_CONFIRM,
        focus: FocusTarget.MODAL,
        backupScreen: null
      })
    ).toBe("modal");
  });

  it("applies resolved alias keys to hint items", () => {
    const resolved = resolveKeymapAliases(
      normalizeKeymapAliases({
        list: {
          list_open_search: ["Ctrl+F"],
          list_open_add: ["n"]
        }
      })
    );
    const items = buildWhichKeyHintItems({ context: "list", resolvedAliases: resolved });
    const keysByLabel = Object.fromEntries(items.map((item) => [item.label, item.key]));
    expect(keysByLabel.search).toBe("Ctrl+F");
    expect(keysByLabel.add).toBe("n");
  });

  it("builds left-rail hint lines from shared model with alias substitution", () => {
    const resolved = resolveKeymapAliases(
      normalizeKeymapAliases({
        list: {
          list_open_tag_panel: ["x"]
        },
        backup: {
          backup_back: ["Ctrl+B"]
        }
      })
    );
    const lines = buildLeftRailHintLines({ context: "list", resolvedAliases: resolved });
    expect(lines.some((line) => line.includes("x: TAG PANEL"))).toBe(true);
    const backupLines = buildLeftRailHintLines({
      context: "backup",
      resolvedAliases: resolved
    });
    expect(backupLines).toContain("Ctrl+B: BACK");
    expect(backupLines).toContain("1..4: MENU");
  });

  it("builds prefix popup for pending Ctrl+g/Ctrl+p/Ctrl+y prefix and resolves alias-aware targets", () => {
    const resolved = resolveKeymapAliases(
      normalizeKeymapAliases({
        list: {
          list_jump_top: ["t"],
          list_jump_bottom: ["b"]
        }
      })
    );
    const popup = buildWhichKeyPrefixPopup({
      pendingGPrefix: true,
      resolvedAliases: resolved
    });
    expect(popup?.title).toBe("PREFIX: Ctrl+g / Ctrl+p / Ctrl+y");
    expect(popup?.hints).toEqual([
      { key: "t", label: "jump top", actionId: "list_jump_top" },
      { key: "b", label: "jump bottom", actionId: "list_jump_bottom" },
      { key: "Esc", label: "cancel prefix" }
    ]);
    expect(
      buildWhichKeyPrefixPopup({
        pendingGPrefix: false,
        resolvedAliases: resolved
      })
    ).toBeNull();
  });
});
