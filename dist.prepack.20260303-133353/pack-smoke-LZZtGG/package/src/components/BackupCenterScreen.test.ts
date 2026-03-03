import { describe, expect, it } from "bun:test";
import {
  formatBackupFileSize,
  formatBackupFileTimestamp,
  getStepLabel,
  isScreenForInput,
  resolveBackupWheelDelta,
  resolveImportPickerWindow
} from "./BackupCenterScreen";

describe("BackupCenterScreen helpers", () => {
  it("formats backup timestamps in local YYYY-MM-DD HH:MM:SS", () => {
    const value = new Date(2026, 0, 2, 3, 4, 5).getTime();
    expect(formatBackupFileTimestamp(value)).toBe("2026-01-02 03:04:05");
  });

  it("formats backup sizes across units", () => {
    expect(formatBackupFileSize(512)).toBe("512 B");
    expect(formatBackupFileSize(1024)).toBe("1.0 KiB");
    expect(formatBackupFileSize(1024 * 1024)).toBe("1.0 MiB");
  });

  it("maps screens to step labels", () => {
    expect(getStepLabel("menu")).toBe("MENU");
    expect(getStepLabel("calendar_import_dryrun")).toBe("CALENDAR / IMPORT");
    expect(getStepLabel("error")).toBe("ERROR");
  });

  it("resolves focusable input screens by kind", () => {
    expect(isScreenForInput("import_path", "data-import-path")).toBe(true);
    expect(isScreenForInput("calendar_import_horizon", "calendar-import-horizon")).toBe(true);
    expect(isScreenForInput("menu", "calendar-import-horizon")).toBe(false);
  });

  it("computes picker window bounds with clamping", () => {
    const deepWindow = resolveImportPickerWindow({
      fileCount: 20,
      selectedIndex: 19,
      scrollOffset: 0,
      visibleRows: 4
    });
    expect(deepWindow).toEqual({ selectedIndex: 19, start: 16, end: 20 });

    const shortWindow = resolveImportPickerWindow({
      fileCount: 2,
      selectedIndex: 9,
      scrollOffset: 9,
      visibleRows: 8
    });
    expect(shortWindow).toEqual({ selectedIndex: 1, start: 0, end: 2 });
  });

  it("maps backup wheel directions to vertical deltas", () => {
    expect(resolveBackupWheelDelta("up")).toBe(-1);
    expect(resolveBackupWheelDelta("down")).toBe(1);
    expect(resolveBackupWheelDelta("left")).toBe(0);
    expect(resolveBackupWheelDelta("right")).toBe(0);
    expect(resolveBackupWheelDelta(undefined)).toBe(0);
  });
});
