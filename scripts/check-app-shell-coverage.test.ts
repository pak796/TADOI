import { describe, expect, it } from "bun:test";
import {
  findLcovRecord,
  parseArgs,
  parseLcov,
} from "./check-app-shell-coverage";

describe("check-app-shell-coverage parseArgs", () => {
  it("parses explicit thresholds and file path", () => {
    const parsed = parseArgs([
      "--lcov-file",
      "tmp/lcov.info",
      "--file",
      "src/app/App.tsx",
      "--min-lines",
      "42.5",
      "--min-functions",
      "39",
    ]);

    expect(parsed).toEqual({
      lcovFile: "tmp/lcov.info",
      file: "src/app/App.tsx",
      minLines: 42.5,
      minFunctions: 39,
    });
  });
});

describe("check-app-shell-coverage LCOV parsing", () => {
  it("parses line/function coverage and finds target records", () => {
    const lcov = [
      "TN:",
      "SF:/repo/src/app/App.tsx",
      "DA:1,1",
      "DA:2,0",
      "FNDA:3,init",
      "FNDA:0,teardown",
      "end_of_record",
      "SF:/repo/src/other.ts",
      "DA:1,1",
      "DA:2,1",
      "FNDA:1,run",
      "end_of_record",
    ].join("\n");

    const records = parseLcov(lcov);
    expect(records.length).toBe(2);

    const appRecord = findLcovRecord(records, "src/app/App.tsx", "/repo");
    expect(appRecord).toBeDefined();
    expect(appRecord?.linesFound).toBe(2);
    expect(appRecord?.linesHit).toBe(1);
    expect(appRecord?.functionsFound).toBe(2);
    expect(appRecord?.functionsHit).toBe(1);
  });
});
