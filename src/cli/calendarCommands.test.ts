import { describe, expect, it } from "bun:test";
import {
  parseCalendarExportArgs,
  runCalendarCommand
} from "./calendarCommands";

describe("parseCalendarExportArgs", () => {
  it("requires --out unless --help is present", () => {
    const parsed = parseCalendarExportArgs([]);
    expect(parsed.ok).toBe(false);

    const help = parseCalendarExportArgs(["--help"]);
    expect(help.ok).toBe(true);
  });

  it("uses next7 as the default range", () => {
    const parsed = parseCalendarExportArgs(["--out", "./out.ics"]);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.range).toBe("next7");
  });

  it("parses view and range flags", () => {
    const parsed = parseCalendarExportArgs([
      "--out=./out.ics",
      "--view",
      "Work",
      "--range",
      "month"
    ]);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.outPath).toBe("./out.ics");
    expect(parsed.value.viewName).toBe("Work");
    expect(parsed.value.range).toBe("month");
  });

  it("rejects invalid ranges", () => {
    const parsed = parseCalendarExportArgs([
      "--out",
      "./out.ics",
      "--range",
      "year"
    ]);
    expect(parsed.ok).toBe(false);
  });
});

describe("runCalendarCommand", () => {
  it("returns success for --help", async () => {
    const code = await runCalendarCommand("export", ["--help"]);
    expect(code).toBe(0);
  });
});
