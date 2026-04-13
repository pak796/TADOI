import { describe, expect, it } from "bun:test";
import {
  buildShellCommandLine,
  resolveCurrentTadoiInvocation,
} from "./invocation";

describe("resolveCurrentTadoiInvocation", () => {
  it("uses execPath + script arg when running through an interpreter", () => {
    const invocation = resolveCurrentTadoiInvocation(
      ["/usr/local/bin/bun", "/repo/src/index.tsx", "reminders", "tick"],
      "/usr/local/bin/bun",
    );
    expect(invocation).toEqual({
      command: "/usr/local/bin/bun",
      baseArgs: ["/repo/src/index.tsx"],
    });
  });

  it("uses packaged binary exec path when argv[0] matches execPath", () => {
    const invocation = resolveCurrentTadoiInvocation(
      ["/Applications/TADOI/tadoi", "reminders", "tick"],
      "/Applications/TADOI/tadoi",
    );
    expect(invocation).toEqual({
      command: "/Applications/TADOI/tadoi",
      baseArgs: [],
    });
  });
});

describe("buildShellCommandLine", () => {
  it("quotes windows arguments for cmd-compatible execution", () => {
    const commandLine = buildShellCommandLine(
      ["C:\\Program Files\\TADOI\\tadoi.exe", "remind", "--event", "id 123"],
      "win32",
    );
    expect(commandLine).toBe(
      '"C:\\Program Files\\TADOI\\tadoi.exe" remind --event "id 123"',
    );
  });
});
