import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

export type CompletionShell = "bash" | "zsh" | "fish";
export type CompletionLayout = "user" | "linux-system" | "macos-system";

export type InstallCompletionOptions = {
  layout: CompletionLayout;
  shells: CompletionShell[];
  destRoot?: string;
  dryRun: boolean;
  strict: boolean;
};

export type CompletionInstallEntry = {
  shell: CompletionShell;
  sourcePath: string;
  targetPath: string;
};

const ALL_SHELLS: CompletionShell[] = ["bash", "zsh", "fish"];

function isCompletionLayout(value: string): value is CompletionLayout {
  return (
    value === "user" || value === "linux-system" || value === "macos-system"
  );
}

function parseShellList(raw: string): CompletionShell[] {
  const normalized = raw.trim().toLowerCase();
  if (normalized === "all") {
    return [...ALL_SHELLS];
  }
  const tokens = normalized
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  if (tokens.length === 0) {
    throw new Error("--shells requires at least one shell name");
  }
  const invalid = tokens.filter(
    (token) => token !== "bash" && token !== "zsh" && token !== "fish",
  );
  if (invalid.length > 0) {
    throw new Error(`Invalid shell name(s): ${invalid.join(", ")}`);
  }
  return Array.from(new Set(tokens)) as CompletionShell[];
}

function requireValue(args: string[], index: number, flag: string): string {
  const next = args[index + 1];
  if (!next || next.startsWith("-")) {
    throw new Error(`${flag} requires a value`);
  }
  return next;
}

export function parseInstallCompletionArgs(
  args: string[] = process.argv.slice(2),
): InstallCompletionOptions {
  let layout: CompletionLayout = "user";
  let shells: CompletionShell[] = [...ALL_SHELLS];
  let destRoot: string | undefined;
  let dryRun = false;
  let strict = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--layout") {
      const value = requireValue(args, i, "--layout");
      if (!isCompletionLayout(value)) {
        throw new Error(
          `--layout must be one of: user, linux-system, macos-system`,
        );
      }
      layout = value;
      i += 1;
      continue;
    }
    if (arg.startsWith("--layout=")) {
      const value = arg.slice("--layout=".length);
      if (!isCompletionLayout(value)) {
        throw new Error(
          `--layout must be one of: user, linux-system, macos-system`,
        );
      }
      layout = value;
      continue;
    }
    if (arg === "--shells") {
      shells = parseShellList(requireValue(args, i, "--shells"));
      i += 1;
      continue;
    }
    if (arg.startsWith("--shells=")) {
      shells = parseShellList(arg.slice("--shells=".length));
      continue;
    }
    if (arg === "--dest-root") {
      destRoot = requireValue(args, i, "--dest-root");
      i += 1;
      continue;
    }
    if (arg.startsWith("--dest-root=")) {
      const value = arg.slice("--dest-root=".length).trim();
      if (value.length === 0) {
        throw new Error("--dest-root requires a value");
      }
      destRoot = value;
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--strict") {
      strict = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    layout,
    shells,
    ...(destRoot ? { destRoot } : {}),
    dryRun,
    strict,
  };
}

function stripAbsolutePrefix(inputPath: string): string {
  const normalized = path.normalize(inputPath);
  return normalized.replace(/^([\\/])+/, "");
}

function withDestRoot(
  targetPath: string,
  destRoot: string | undefined,
): string {
  if (!destRoot) {
    return targetPath;
  }
  return path.join(destRoot, stripAbsolutePrefix(targetPath));
}

function targetPathByLayout(
  layout: CompletionLayout,
  shell: CompletionShell,
  homeDir: string,
): string {
  if (layout === "linux-system") {
    if (shell === "bash") return "/usr/share/bash-completion/completions/tadoi";
    if (shell === "zsh") return "/usr/share/zsh/site-functions/_tadoi";
    return "/usr/share/fish/vendor_completions.d/tadoi.fish";
  }
  if (layout === "macos-system") {
    if (shell === "bash")
      return "/usr/local/share/bash-completion/completions/tadoi";
    if (shell === "zsh") return "/usr/local/share/zsh/site-functions/_tadoi";
    return "/usr/local/share/fish/vendor_completions.d/tadoi.fish";
  }
  if (shell === "bash")
    return path.join(
      homeDir,
      ".local",
      "share",
      "bash-completion",
      "completions",
      "tadoi",
    );
  if (shell === "zsh")
    return path.join(homeDir, ".zsh", "completions", "_tadoi");
  return path.join(homeDir, ".config", "fish", "completions", "tadoi.fish");
}

function sourcePathForShell(repoRoot: string, shell: CompletionShell): string {
  const completionsDir = path.join(repoRoot, "docs", "completions");
  if (shell === "bash") return path.join(completionsDir, "tadoi.bash");
  if (shell === "zsh") return path.join(completionsDir, "_tadoi");
  return path.join(completionsDir, "tadoi.fish");
}

export function resolveCompletionInstallPlan(
  options: InstallCompletionOptions,
  context: { repoRoot?: string; homeDir?: string } = {},
): CompletionInstallEntry[] {
  const repoRoot = context.repoRoot ?? path.resolve(import.meta.dir, "..");
  const homeDir = context.homeDir ?? os.homedir();

  return options.shells.map((shell) => {
    const targetPath = targetPathByLayout(options.layout, shell, homeDir);
    return {
      shell,
      sourcePath: sourcePathForShell(repoRoot, shell),
      targetPath: withDestRoot(targetPath, options.destRoot),
    };
  });
}

export async function installCompletions(
  options: InstallCompletionOptions,
  context: { repoRoot?: string; homeDir?: string } = {},
): Promise<{
  installed: CompletionInstallEntry[];
  failed: Array<{ entry: CompletionInstallEntry; error: string }>;
}> {
  const plan = resolveCompletionInstallPlan(options, context);
  const installed: CompletionInstallEntry[] = [];
  const failed: Array<{ entry: CompletionInstallEntry; error: string }> = [];

  for (const entry of plan) {
    try {
      if (options.dryRun) {
        console.log(
          `[completions] dry-run ${entry.shell}: ${entry.sourcePath} -> ${entry.targetPath}`,
        );
        installed.push(entry);
        continue;
      }
      await fs.mkdir(path.dirname(entry.targetPath), { recursive: true });
      await fs.copyFile(entry.sourcePath, entry.targetPath);
      await fs.chmod(entry.targetPath, 0o644);
      console.log(
        `[completions] installed ${entry.shell}: ${entry.targetPath}`,
      );
      installed.push(entry);
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      failed.push({ entry, error: detail });
      console.error(
        `[completions] failed ${entry.shell}: ${entry.targetPath} (${detail})`,
      );
    }
  }

  return { installed, failed };
}

async function main(): Promise<void> {
  const skip = process.env.TADOI_SKIP_COMPLETION_INSTALL?.trim() === "1";
  if (skip) {
    console.log("[completions] skipped (TADOI_SKIP_COMPLETION_INSTALL=1)");
    return;
  }

  let options: InstallCompletionOptions;
  try {
    options = parseInstallCompletionArgs();
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`[completions] ${detail}`);
    process.exit(1);
  }

  const result = await installCompletions(options);
  if (result.failed.length > 0 && options.strict) {
    process.exit(1);
  }
}

if (import.meta.main) {
  void main();
}
