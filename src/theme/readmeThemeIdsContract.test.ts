import { describe, expect, it } from "bun:test";
import { readFileSync } from "fs";
import path from "path";
import { THEME_ORDER } from "./themes";

function parseThemeIdsSection(readme: string): string[] {
  const startMarker = "Theme IDs:";
  const endMarker = "Notification defaults:";
  const startIndex = readme.indexOf(startMarker);
  const endIndex = readme.indexOf(endMarker);
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return [];
  }

  const section = readme.slice(startIndex, endIndex);
  const matches = Array.from(section.matchAll(/`([a-zA-Z0-9]+)`/g));
  return matches.map((match) => match[1]);
}

describe("README theme-id contract", () => {
  it("keeps README theme-id docs synchronized with source theme order", () => {
    const readmePath = path.resolve(import.meta.dir, "..", "..", "README.md");
    const readme = readFileSync(readmePath, "utf8");
    const listedThemeIds = parseThemeIdsSection(readme);
    expect(listedThemeIds).toEqual(THEME_ORDER);
  });
});
