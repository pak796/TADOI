import { describe, expect, it } from "bun:test";
import {
  describeTaskEditorContinuation,
  resolveTaskEditorContinuationForLeftRail
} from "./routingContinuations";

describe("routingContinuations helpers", () => {
  it("maps left-rail items to task-editor continuations", () => {
    expect(resolveTaskEditorContinuationForLeftRail("LIST")).toBe("open_list");
    expect(resolveTaskEditorContinuationForLeftRail("BACKUP")).toBe("open_backup_center");
    expect(resolveTaskEditorContinuationForLeftRail("HELP")).toBe("open_help");
  });

  it("describes continuation labels for unsaved modal copy", () => {
    expect(describeTaskEditorContinuation("open_list")).toBe("return to list");
    expect(describeTaskEditorContinuation("open_backup_center")).toBe("open Backup Center");
    expect(describeTaskEditorContinuation("open_delete_confirm")).toBe(
      "open delete confirmation"
    );
  });
});
