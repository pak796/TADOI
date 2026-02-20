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
    expect(appSource).toContain("Tab links focus: Enter/o open, c copy, l/e/d manage links");

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
});
