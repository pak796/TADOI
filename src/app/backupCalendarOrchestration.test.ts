import { describe, expect, it } from "bun:test";
import { initialBackupCenterState } from "../state/backupCenterFlow";
import {
  parseCalendarImportHorizonOrThrow,
  resolveCalendarViewSelectionDigit,
  shouldRequireBackupReplaceConfirmation
} from "./backupCalendarOrchestration";

describe("backupCalendarOrchestration helpers", () => {
  it("resolves calendar view slot digits", () => {
    expect(resolveCalendarViewSelectionDigit(0, [])).toBeNull();
    expect(resolveCalendarViewSelectionDigit(1, [])).toBeUndefined();
    expect(
      resolveCalendarViewSelectionDigit(2, [{ id: "1", name: "Work", filters: { status: "open", due: "any" }, createdAt: 0, updatedAt: 0 }])
    ).toBe("Work");
  });

  it("parses valid horizon and rejects invalid values", () => {
    expect(parseCalendarImportHorizonOrThrow("365")).toBe(365);
    expect(() => parseCalendarImportHorizonOrThrow("0")).toThrow();
    expect(() => parseCalendarImportHorizonOrThrow("3651")).toThrow();
    expect(() => parseCalendarImportHorizonOrThrow("abc")).toThrow();
  });

  it("requires replace confirmation only in replace mode without confirmation", () => {
    expect(shouldRequireBackupReplaceConfirmation(initialBackupCenterState)).toBe(false);
    expect(
      shouldRequireBackupReplaceConfirmation({
        ...initialBackupCenterState,
        importMode: "replace",
        replaceConfirmed: false
      })
    ).toBe(true);
    expect(
      shouldRequireBackupReplaceConfirmation({
        ...initialBackupCenterState,
        importMode: "replace",
        replaceConfirmed: true
      })
    ).toBe(false);
  });
});
