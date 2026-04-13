import { describe, expect, it } from "bun:test";
import path from "node:path";
import {
  parseInstallCompletionArgs,
  resolveCompletionInstallPlan,
} from "./install-completions";

describe("install-completions argument parsing", () => {
  it("uses user layout defaults", () => {
    const parsed = parseInstallCompletionArgs([]);
    expect(parsed.layout).toBe("user");
    expect(parsed.shells).toEqual(["bash", "zsh", "fish"]);
    expect(parsed.dryRun).toBe(false);
    expect(parsed.strict).toBe(false);
  });

  it("parses layout/shells/dest-root and flags", () => {
    const parsed = parseInstallCompletionArgs([
      "--layout=linux-system",
      "--shells",
      "bash,fish",
      "--dest-root",
      "/tmp/payload",
      "--dry-run",
      "--strict",
    ]);
    expect(parsed.layout).toBe("linux-system");
    expect(parsed.shells).toEqual(["bash", "fish"]);
    expect(parsed.destRoot).toBe("/tmp/payload");
    expect(parsed.dryRun).toBe(true);
    expect(parsed.strict).toBe(true);
  });

  it("rejects invalid shell list", () => {
    expect(() => parseInstallCompletionArgs(["--shells", "bash,pwsh"])).toThrow(
      "Invalid shell name(s): pwsh",
    );
  });
});

describe("install-completions plan resolution", () => {
  const repoRoot = "/repo";
  const homeDir = "/home/tester";

  it("resolves user layout targets", () => {
    const plan = resolveCompletionInstallPlan(
      {
        layout: "user",
        shells: ["bash", "zsh", "fish"],
        dryRun: false,
        strict: false,
      },
      { repoRoot, homeDir },
    );
    expect(plan.map((entry) => entry.targetPath)).toEqual([
      "/home/tester/.local/share/bash-completion/completions/tadoi",
      "/home/tester/.zsh/completions/_tadoi",
      "/home/tester/.config/fish/completions/tadoi.fish",
    ]);
    expect(plan[0]?.sourcePath).toBe(
      path.join("/repo", "docs", "completions", "tadoi.bash"),
    );
  });

  it("resolves payload-rooted linux system targets", () => {
    const plan = resolveCompletionInstallPlan(
      {
        layout: "linux-system",
        shells: ["bash", "zsh", "fish"],
        destRoot: "/tmp/payload",
        dryRun: false,
        strict: true,
      },
      { repoRoot, homeDir },
    );
    expect(plan.map((entry) => entry.targetPath)).toEqual([
      "/tmp/payload/usr/share/bash-completion/completions/tadoi",
      "/tmp/payload/usr/share/zsh/site-functions/_tadoi",
      "/tmp/payload/usr/share/fish/vendor_completions.d/tadoi.fish",
    ]);
  });
});
