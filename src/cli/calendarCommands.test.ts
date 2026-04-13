import { describe, expect, it } from "bun:test";
import {
  parseCalendarImportArgs,
  parseCalendarExportArgs,
  runCalendarCommand,
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
    expect(parsed.value.privacy).toBe("minimal");
  });

  it("parses view and range flags", () => {
    const parsed = parseCalendarExportArgs([
      "--out=./out.ics",
      "--view",
      "Work",
      "--range",
      "month",
      "--privacy",
      "full",
    ]);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.outPath).toBe("./out.ics");
    expect(parsed.value.viewName).toBe("Work");
    expect(parsed.value.range).toBe("month");
    expect(parsed.value.privacy).toBe("full");
  });

  it("rejects invalid ranges", () => {
    const parsed = parseCalendarExportArgs([
      "--out",
      "./out.ics",
      "--range",
      "year",
    ]);
    expect(parsed.ok).toBe(false);
  });

  it("supports --include-details compatibility flag", () => {
    const parsed = parseCalendarExportArgs([
      "--out",
      "./out.ics",
      "--include-details",
    ]);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.privacy).toBe("full");
  });

  it("rejects invalid privacy values", () => {
    const parsed = parseCalendarExportArgs([
      "--out",
      "./out.ics",
      "--privacy",
      "everything",
    ]);
    expect(parsed.ok).toBe(false);
  });
});

describe("runCalendarCommand", () => {
  it("returns success for --help", async () => {
    const code = await runCalendarCommand("export", ["--help"]);
    expect(code).toBe(0);
  });

  it("returns success for calendar import --help", async () => {
    const code = await runCalendarCommand("import", ["--help"]);
    expect(code).toBe(0);
  });

  it("returns parse/validation exit code for calendar export usage errors", async () => {
    const code = await runCalendarCommand("export", []);
    expect(code).toBe(2);
  });

  it("returns parse/validation exit code for calendar import usage errors", async () => {
    const code = await runCalendarCommand("import", []);
    expect(code).toBe(2);
  });
});

describe("parseCalendarImportArgs", () => {
  it("requires --in unless --help is present", () => {
    const parsed = parseCalendarImportArgs([]);
    expect(parsed.ok).toBe(false);

    const help = parseCalendarImportArgs(["--help"]);
    expect(help.ok).toBe(true);
  });

  it("uses defaults for range/mode/horizon", () => {
    const parsed = parseCalendarImportArgs(["--in", "./in.ics"]);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.range).toBe("next7");
    expect(parsed.value.mode).toBe("merge");
    expect(parsed.value.horizonDays).toBe(365);
    expect(parsed.value.dryRun).toBe(false);
  });

  it("parses mode/range/horizon/view/tag/report and dry-run", () => {
    const parsed = parseCalendarImportArgs([
      "--in=./incoming.ics",
      "--view",
      "Work",
      "--range",
      "month",
      "--mode",
      "update",
      "--horizon-days",
      "730",
      "--dry-run",
      "--tag",
      "imported",
      "--report=./report.json",
    ]);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.inPath).toBe("./incoming.ics");
    expect(parsed.value.viewName).toBe("Work");
    expect(parsed.value.range).toBe("month");
    expect(parsed.value.mode).toBe("update");
    expect(parsed.value.horizonDays).toBe(730);
    expect(parsed.value.dryRun).toBe(true);
    expect(parsed.value.tag).toBe("imported");
    expect(parsed.value.reportPath).toBe("./report.json");
  });

  it("validates range/mode enums", () => {
    const badRange = parseCalendarImportArgs([
      "--in",
      "./in.ics",
      "--range",
      "year",
    ]);
    expect(badRange.ok).toBe(false);

    const badMode = parseCalendarImportArgs([
      "--in",
      "./in.ics",
      "--mode",
      "replace",
    ]);
    expect(badMode.ok).toBe(false);
  });

  it("enforces horizon bounds", () => {
    const zero = parseCalendarImportArgs([
      "--in",
      "./in.ics",
      "--horizon-days",
      "0",
    ]);
    expect(zero.ok).toBe(false);

    const tooHigh = parseCalendarImportArgs([
      "--in",
      "./in.ics",
      "--horizon-days",
      "3651",
    ]);
    expect(tooHigh.ok).toBe(false);
  });

  it("rejects unknown flags and positional args", () => {
    const unknown = parseCalendarImportArgs(["--in", "./in.ics", "--wat"]);
    expect(unknown.ok).toBe(false);

    const positional = parseCalendarImportArgs(["--in", "./in.ics", "extra"]);
    expect(positional.ok).toBe(false);
  });
});
