import { describe, expect, it } from "bun:test";
import { decideTaskLinkOpen } from "./linkOpenFlow";

describe("decideTaskLinkOpen", () => {
  it("allows safe manual https links without confirmation", () => {
    expect(
      decideTaskLinkOpen({
        target: "https://example.com/docs",
        kind: "url",
        source: "manual"
      })
    ).toEqual({
      policy: "allow",
      scheme: "https",
      target: "https://example.com/docs"
    });
  });

  it("requires confirmation for risky links by default", () => {
    expect(
      decideTaskLinkOpen({
        target: "vscode://repo/file",
        kind: "url",
        source: "manual"
      })
    ).toEqual({
      policy: "confirm",
      scheme: "vscode",
      target: "vscode://repo/file"
    });

    expect(
      decideTaskLinkOpen({
        target: "/tmp/a file.txt",
        kind: "path",
        source: "manual"
      })
    ).toEqual({
      policy: "confirm",
      scheme: "path",
      target: "/tmp/a file.txt"
    });
  });

  it("blocks risky links when policy is block", () => {
    expect(
      decideTaskLinkOpen(
        {
          target: "file:///tmp/report.txt",
          kind: "url",
          source: "manual"
        },
        { nonHttpLinkPolicy: "block" }
      )
    ).toEqual({
      policy: "block",
      scheme: "file",
      target: "file:///tmp/report.txt"
    });
  });
});
