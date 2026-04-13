import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { CLI_NAME } from "../brand/brand";
import { redactedLogger } from "../logging/redactedLogger";
import {
  buildShellCommandLine,
  resolveCurrentTadoiInvocation,
  type TadoiInvocation,
} from "../reminders/invocation";
import { uninstallReminderScheduler } from "../reminders/scheduler";
import { CLI_EXIT_CODE } from "./exitCodes";

type RemovalStatus =
  | { status: "removed" }
  | { status: "missing" }
  | { status: "failed"; error: string };

export type UninstallCommandRuntime = {
  platform: NodeJS.Platform;
  homeDir: () => string;
  resolveInvocation: () => TadoiInvocation;
  uninstallReminderScheduler: typeof uninstallReminderScheduler;
  removePath: (targetPath: string) => Promise<RemovalStatus>;
  log: (line: string) => void;
  error: (line: string) => void;
};

const DEFAULT_RUNTIME: UninstallCommandRuntime = {
  platform: process.platform,
  homeDir: () => os.homedir(),
  resolveInvocation: () => resolveCurrentTadoiInvocation(),
  uninstallReminderScheduler,
  removePath: async (targetPath: string) => {
    try {
      await fs.unlink(targetPath);
      return { status: "removed" };
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      if (code === "ENOENT") {
        return { status: "missing" };
      }
      return { status: "failed", error: detail };
    }
  },
  log: (line) => redactedLogger.log(line),
  error: (line) => redactedLogger.error(line),
};

function usage(): string {
  return [
    "Usage:",
    `  ${CLI_NAME} uninstall`,
    `  ${CLI_NAME} --uninstall`,
    "",
    "Removes user shell completions and attempts reminder helper cleanup.",
    "Keeps task data, notes, and settings.",
    "Then prints the remaining platform/package uninstall step for the main CLI install.",
  ].join("\n");
}

function userCompletionTargets(
  homeDir: string,
): Array<{ shell: "bash" | "zsh" | "fish"; targetPath: string }> {
  return [
    {
      shell: "bash",
      targetPath: path.join(
        homeDir,
        ".local",
        "share",
        "bash-completion",
        "completions",
        CLI_NAME,
      ),
    },
    {
      shell: "zsh",
      targetPath: path.join(homeDir, ".zsh", "completions", `_${CLI_NAME}`),
    },
    {
      shell: "fish",
      targetPath: path.join(
        homeDir,
        ".config",
        "fish",
        "completions",
        `${CLI_NAME}.fish`,
      ),
    },
  ];
}

function renderInvocationLine(
  invocation: TadoiInvocation,
  platform: NodeJS.Platform,
): string {
  return buildShellCommandLine(
    [invocation.command, ...invocation.baseArgs],
    platform,
  );
}

function buildMainInstallInstructions(options: {
  invocation: TadoiInvocation;
  platform: NodeJS.Platform;
}): string[] {
  const currentEntry = renderInvocationLine(
    options.invocation,
    options.platform,
  );
  const lines = [`current_cli_entry: ${currentEntry}`];

  if (options.invocation.baseArgs.length > 0) {
    lines.push(
      "script_based_install: remove the package, wrapper, or checkout that owns the script path above",
    );
    lines.push(
      "common_global_examples: bun remove -g tadoi | npm uninstall -g tadoi",
    );
    return lines;
  }

  if (options.platform === "darwin") {
    lines.push("macos_pkg_or_manual: sudo rm -f /usr/local/bin/tadoi");
    lines.push(
      "macos_system_completions: sudo rm -f /usr/local/share/bash-completion/completions/tadoi /usr/local/share/zsh/site-functions/_tadoi /usr/local/share/fish/vendor_completions.d/tadoi.fish",
    );
    lines.push("open_new_terminal: required after removing the main install");
    return lines;
  }

  if (options.platform === "win32") {
    lines.push(
      "windows_installer: uninstall TADOI from Settings > Apps or Control Panel",
    );
    lines.push(
      "windows_manual_binary: delete the install directory that contains the current CLI entry and remove it from PATH",
    );
    lines.push("open_new_terminal: required after removing the main install");
    return lines;
  }

  lines.push(
    "linux_deb: remove the package with your distro package manager (example: sudo apt remove tadoi)",
  );
  lines.push(
    "linux_appimage_or_manual: delete the AppImage or binary that contains the current CLI entry",
  );
  lines.push(
    "linux_system_completions: if you installed them manually, remove /usr/share/bash-completion/completions/tadoi /usr/share/zsh/site-functions/_tadoi /usr/share/fish/vendor_completions.d/tadoi.fish",
  );
  return lines;
}

export async function runUninstallCommand(
  args: string[],
  runtime: UninstallCommandRuntime = DEFAULT_RUNTIME,
): Promise<number> {
  if (args.includes("--help") || args.includes("-h")) {
    runtime.log(usage());
    return CLI_EXIT_CODE.SUCCESS;
  }

  if (args.length > 0) {
    runtime.error(`Error: unknown uninstall argument '${args[0]}'.`);
    runtime.error(usage());
    return CLI_EXIT_CODE.PARSE_OR_VALIDATION;
  }

  const homeDir = runtime.homeDir();
  const invocation = runtime.resolveInvocation();
  let hadFailure = false;

  runtime.log("cleanup_scope: user shell completions + reminder helper");
  runtime.log("retained_data: yes");
  runtime.log("retained_notes: yes");
  runtime.log("retained_settings: yes");

  try {
    const reminderStatus = await runtime.uninstallReminderScheduler({
      platform: runtime.platform,
      homeDir,
    });
    runtime.log("reminder_helper: best-effort uninstall issued");
    for (const detail of reminderStatus.details) {
      runtime.log(`- ${detail}`);
    }
  } catch (error: unknown) {
    hadFailure = true;
    runtime.error(
      `reminder_helper: failed (${error instanceof Error ? error.message : String(error)})`,
    );
  }

  for (const entry of userCompletionTargets(homeDir)) {
    const removal = await runtime.removePath(entry.targetPath);
    if (removal.status === "removed") {
      runtime.log(`${entry.shell}_completion: removed (${entry.targetPath})`);
      continue;
    }
    if (removal.status === "missing") {
      runtime.log(
        `${entry.shell}_completion: not present (${entry.targetPath})`,
      );
      continue;
    }
    hadFailure = true;
    runtime.error(
      `${entry.shell}_completion: failed (${entry.targetPath}) (${removal.error})`,
    );
  }

  runtime.log("main_install_step: required");
  for (const line of buildMainInstallInstructions({
    invocation,
    platform: runtime.platform,
  })) {
    runtime.log(`- ${line}`);
  }

  return hadFailure ? CLI_EXIT_CODE.IO_ERROR : CLI_EXIT_CODE.SUCCESS;
}
