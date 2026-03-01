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
    expect(keysByLabel.TITS).toBe("`");
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
    expect(lines).toContain("`: TITS");
    const backupLines = buildLeftRailHintLines({
      context: "backup",
      resolvedAliases: resolved
    });
    expect(backupLines).toContain("Ctrl+B: BACK");
    expect(backupLines).toContain("1..4: MENU");
  });

  it("includes note delete hints for notes list and notes view contexts", () => {
    const noteListItems = buildWhichKeyHintItems({
      context: "notes",
      resolvedAliases: null
    });
    expect(noteListItems.some((item) => item.key === "d" && item.label === "delete tome")).toBe(
      true
    );

    const noteViewItems = buildWhichKeyHintItems({
      context: "notes_view",
      resolvedAliases: null
    });
    expect(noteViewItems.some((item) => item.key === "d" && item.label === "delete note")).toBe(
      true
    );

    const noteViewLines = buildLeftRailHintLines({
      context: "notes_view",
      resolvedAliases: null
    });
    expect(noteViewLines.some((line) => line.includes("d: DELETE TOME"))).toBe(true);
  });

  it("includes tome rename/delete hints in notes surfaces", () => {
    const items = buildWhichKeyHintItems({ context: "notes", resolvedAliases: null });
    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "r/R", label: "rename tome" }),
        expect.objectContaining({ key: "i", label: "reindex" }),
        expect.objectContaining({ key: "d", label: "delete tome" })
      ])
    );

    const lines = buildLeftRailHintLines({ context: "notes", resolvedAliases: null });
    expect(lines).toContain("r/R: RENAME TOME");
    expect(lines).toContain("i: REINDEX");
    expect(lines).toContain("o: ROOT SETTINGS");
    expect(lines).toContain("d: DELETE TOME");
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
