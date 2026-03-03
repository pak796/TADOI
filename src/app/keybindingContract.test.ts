import { describe, expect, it } from "bun:test";
import { promises as fs } from "fs";
import { fileURLToPath } from "url";
import { FocusTarget, Mode } from "../domain/models";
import { handleKey, type KeyInput, type KeyRouterContext } from "./keyRouter";
import { initialUIState } from "../ui/state";

function run(
  key: Partial<KeyInput>,
  contextOverrides: Partial<KeyRouterContext> = {}
) {
  const input: KeyInput = {
    name: "",
    sequence: "",
    ctrl: false,
    shift: false,
    ...key
  };
  const context: KeyRouterContext = {
    uiState: initialUIState,
    hasTagInlineSuggestion: false,
    hasDueSuggestion: false,
    timeAutocompleteStep: "none",
    hasPendingGPrefix: false,
    viewsOverlayOpen: false,
    saveViewPromptOpen: false,
    allowEmptyNuxRecoveryImport: false,
    backupScreen: null,
    ...contextOverrides
  };
  return handleKey(input, context);
}

describe("link keybinding contract", () => {
  it("keeps help copy and key router behavior aligned for details links", async () => {
    const appPath = fileURLToPath(new URL("./App.tsx", import.meta.url).href);
    const appSource = await fs.readFile(appPath, "utf8");
    expect(appSource).toContain(
      "Tab links focus, Right notes focus, Right checklist focus"
    );

    const detailsState = {
      ...initialUIState,
      mode: Mode.LIST,
      focus: FocusTarget.DETAILS_LINKS
    };

    expect(run({ name: "enter" }, { uiState: detailsState })).toEqual([
      { scope: "domain", type: "OPEN_SELECTED_LINK" }
    ]);
    expect(run({ name: "o", sequence: "o" }, { uiState: detailsState })).toEqual([
      { scope: "domain", type: "OPEN_SELECTED_LINK" }
    ]);
    expect(run({ name: "c", sequence: "c" }, { uiState: detailsState })).toEqual([
      { scope: "domain", type: "COPY_SELECTED_LINK" }
    ]);
    expect(run({ name: "l", sequence: "l" }, { uiState: detailsState })).toEqual([
      { scope: "domain", type: "OPEN_ADD_TASK_LINK_MODAL" }
    ]);
    expect(run({ name: "e", sequence: "e" }, { uiState: detailsState })).toEqual([
      { scope: "domain", type: "OPEN_EDIT_TASK_LINK_MODAL" }
    ]);
    expect(run({ name: "d", sequence: "d" }, { uiState: detailsState })).toEqual([
      { scope: "domain", type: "OPEN_DELETE_TASK_LINK_MODAL" }
    ]);
  });

  it("keeps legacy tag-cycle docs aligned with lowercase-only router behavior", async () => {
    const usagePath = fileURLToPath(new URL("../../docs/USAGE.md", import.meta.url).href);
    const usageSource = await fs.readFile(usagePath, "utf8");
    expect(usageSource).toContain("- `t`: cycle non-priority tag filter");
    expect(usageSource).not.toContain("`t` / `T`");

    expect(run({ name: "t", sequence: "t" })).toEqual([
      { scope: "domain", type: "TOGGLE_TAG_FILTER" }
    ]);
    expect(run({ name: "T", sequence: "T" })).toEqual([]);
  });

  it("keeps backup center key snapshot aligned with routed keyspace", async () => {
    const specPath = fileURLToPath(new URL("../../TADOI_SPEC_v0.3.9.md", import.meta.url).href);
    const specSource = await fs.readFile(specPath, "utf8");
    expect(specSource).toContain("- backup center menu: `1/2/3/4`, `Enter`, `Esc`");
    expect(specSource).toContain(
      "- backup center import picker: `j/k`, `ArrowUp`/`ArrowDown`, `PageUp`/`PageDown`, `home/end`, `m`, `Enter`, `Esc`"
    );
    expect(specSource).toContain(
      "- backup center content screens: `j/k`, `ArrowUp`/`ArrowDown`, `Ctrl+U`/`Ctrl+D`, `PageUp`/`PageDown`"
    );

    const backupModeState = { ...initialUIState, mode: Mode.BACKUP_CENTER };
    expect(run({ name: "4", sequence: "4" }, { uiState: backupModeState, backupScreen: "menu" })).toEqual([
      { scope: "ui", type: "BACKUP_SELECT_MENU_OPTION", index: 3 }
    ]);
    expect(
      run({ name: "home", sequence: "" }, { uiState: backupModeState, backupScreen: "import_picker" })
    ).toEqual([{ scope: "ui", type: "BACKUP_PICKER_JUMP_SELECTION", target: "start" }]);
    expect(
      run({ name: "end", sequence: "" }, { uiState: backupModeState, backupScreen: "import_picker" })
    ).toEqual([{ scope: "ui", type: "BACKUP_PICKER_JUMP_SELECTION", target: "end" }]);
    expect(
      run({ name: "m", sequence: "m" }, { uiState: backupModeState, backupScreen: "import_picker" })
    ).toEqual([{ scope: "ui", type: "BACKUP_PICKER_OPEN_MANUAL_PATH" }]);
    expect(
      run({ name: "pagedown", sequence: "" }, { uiState: backupModeState, backupScreen: "import_dryrun" })
    ).toEqual([{ scope: "ui", type: "BACKUP_SCROLL_BODY", delta: 8 }]);
    expect(
      run({ ctrl: true, name: "u", sequence: "" }, { uiState: backupModeState, backupScreen: "calendar_import_dryrun" })
    ).toEqual([{ scope: "ui", type: "BACKUP_SCROLL_BODY", delta: -8 }]);
  });

  it("keeps Ctrl+N quick-capture docs aligned with router behavior", async () => {
    const usagePath = fileURLToPath(new URL("../../docs/USAGE.md", import.meta.url).href);
    const usageSource = await fs.readFile(usagePath, "utf8");
    expect(usageSource).toContain("Ctrl+N");

    expect(run({ ctrl: true, name: "n", sequence: "n" })).toEqual([
      { scope: "ui", type: "OPEN_QUICK_CAPTURE" }
    ]);
    expect(
      run(
        { ctrl: true, name: "n", sequence: "n" },
        {
          uiState: {
            ...initialUIState,
            mode: Mode.DASHBOARD,
            focus: FocusTarget.DASHBOARD
          }
        }
      )
    ).toEqual([{ scope: "ui", type: "OPEN_QUICK_CAPTURE" }]);
  });

  it("keeps save-conflict retry hint aligned with banner affordance", async () => {
    const appPath = fileURLToPath(new URL("./App.tsx", import.meta.url).href);
    const appSource = await fs.readFile(appPath, "utf8");

    expect(appSource).toContain("Save conflict recovery");
    expect(appSource).toContain(
      "press R or click the banner to reload and retry."
    );
    expect(appSource).toContain("[R] Reload + Retry");
    expect(appSource).toContain("Press R or click to reload and retry.");
    expect(appSource).toContain("shouldTriggerSaveConflictRetryFromMouse");
  });
});
