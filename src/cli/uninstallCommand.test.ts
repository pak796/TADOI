import { describe, expect, it } from "bun:test";
import { CLI_EXIT_CODE } from "./exitCodes";
import { runUninstallCommand } from "./uninstallCommand";

describe("runUninstallCommand", () => {
  it("prints usage for --help", async () => {
    const logs: string[] = [];
    const errors: string[] = [];
    const code = await runUninstallCommand(["--help"], {
      platform: "linux",
      homeDir: () => "/home/tester",
      resolveInvocation: () => ({
        command: "/usr/bin/tadoi",
        baseArgs: [],
      }),
      uninstallReminderScheduler: async () => ({
        installed: false,
        enabled: false,
        details: [],
      }),
      removePath: async () => ({ status: "missing" }),
      log: (line) => logs.push(line),
      error: (line) => errors.push(line),
    });

    expect(code).toBe(CLI_EXIT_CODE.SUCCESS);
    expect(errors).toEqual([]);
    expect(logs.join("\n")).toContain("Usage:");
    expect(logs.join("\n")).toContain("tadoi uninstall");
    expect(logs.join("\n")).toContain("tadoi --uninstall");
  });

  it("removes user completions and prints linux uninstall guidance", async () => {
    const logs: string[] = [];
    const errors: string[] = [];
    const removedPaths: string[] = [];

    const code = await runUninstallCommand([], {
      platform: "linux",
      homeDir: () => "/home/tester",
      resolveInvocation: () => ({
        command: "/usr/bin/tadoi",
        baseArgs: [],
      }),
      uninstallReminderScheduler: async () => ({
        installed: false,
        enabled: false,
        details: ["systemctl disable: ok", "systemctl daemon-reload: ok"],
      }),
      removePath: async (targetPath) => {
        removedPaths.push(targetPath);
        if (targetPath.endsWith("/_tadoi")) {
          return { status: "missing" };
        }
        return { status: "removed" };
      },
      log: (line) => logs.push(line),
      error: (line) => errors.push(line),
    });

    expect(code).toBe(CLI_EXIT_CODE.SUCCESS);
    expect(errors).toEqual([]);
    expect(removedPaths).toEqual([
      "/home/tester/.local/share/bash-completion/completions/tadoi",
      "/home/tester/.zsh/completions/_tadoi",
      "/home/tester/.config/fish/completions/tadoi.fish",
    ]);
    const output = logs.join("\n");
    expect(output).toContain(
      "cleanup_scope: user shell completions + reminder helper",
    );
    expect(output).toContain("bash_completion: removed");
    expect(output).toContain("zsh_completion: not present");
    expect(output).toContain("fish_completion: removed");
    expect(output).toContain(
      "linux_deb: remove the package with your distro package manager",
    );
    expect(output).toContain("main_install_step: required");
  });

  it("returns io error when completion cleanup fails", async () => {
    const logs: string[] = [];
    const errors: string[] = [];

    const code = await runUninstallCommand([], {
      platform: "darwin",
      homeDir: () => "/Users/tester",
      resolveInvocation: () => ({
        command: "/usr/local/bin/tadoi",
        baseArgs: [],
      }),
      uninstallReminderScheduler: async () => ({
        installed: false,
        enabled: false,
        details: ["launchctl bootout: ok"],
      }),
      removePath: async (targetPath) =>
        targetPath.endsWith("/_tadoi")
          ? { status: "failed", error: "permission denied" }
          : { status: "missing" },
      log: (line) => logs.push(line),
      error: (line) => errors.push(line),
    });

    expect(code).toBe(CLI_EXIT_CODE.IO_ERROR);
    expect(errors.join("\n")).toContain("zsh_completion: failed");
    expect(logs.join("\n")).toContain(
      "macos_pkg_or_manual: sudo rm -f /usr/local/bin/tadoi",
    );
  });

  it("rejects unexpected uninstall args", async () => {
    const logs: string[] = [];
    const errors: string[] = [];

    const code = await runUninstallCommand(["--wat"], {
      platform: "win32",
      homeDir: () => "C:\\Users\\tester",
      resolveInvocation: () => ({
        command: "C:\\Program Files\\TADOI\\tadoi.exe",
        baseArgs: [],
      }),
      uninstallReminderScheduler: async () => ({
        installed: false,
        enabled: false,
        details: [],
      }),
      removePath: async () => ({ status: "missing" }),
      log: (line) => logs.push(line),
      error: (line) => errors.push(line),
    });

    expect(code).toBe(CLI_EXIT_CODE.PARSE_OR_VALIDATION);
    expect(logs).toEqual([]);
    expect(errors.join("\n")).toContain("unknown uninstall argument '--wat'");
  });
});
