import { describe, expect, it } from "bun:test";
import { getHelpLine } from "./help";

describe("getHelpLine note copy", () => {
  it("keeps TOME branding in note help output", () => {
    const help = getHelpLine("note");
    expect(help).toContain("TOME COMMANDS");
    expect(help).toContain("Terminal Oriented Markdown Environment");
    expect(help).toContain("Rebuild TOME index");
    expect(help).toContain('note delete "Query"');
    expect(help).toContain("note restore-defaults");
    expect(help).not.toContain("NOTES COMMANDS");
  });

  it("includes tag lifecycle command help", () => {
    const help = getHelpLine("tag");
    expect(help).toContain("tag rename");
    expect(help).toContain("tag merge");
    expect(help).toContain("--dry-run");
  });
});
