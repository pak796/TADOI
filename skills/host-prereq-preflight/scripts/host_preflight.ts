import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

type Status = "PASS" | "FAIL" | "BLOCKED";
type ProfileName = "core" | "docs" | "release";

type Check = {
  id: string;
  kind: "command" | "env" | "host";
  target: string;
  status: Status;
  message: string;
  fixHint?: string;
  evidence?: string;
};

type ParsedArgs = {
  profile: ProfileName;
  requireCmd: string[];
  requireEnv: string[];
  checkXcodeLicense: boolean;
  minBunVersion?: string;
  jsonOut?: string;
  mdOut?: string;
};

type Semver = {
  major: number;
  minor: number;
  patch: number;
};

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    profile: "core",
    requireCmd: [],
    requireEnv: [],
    checkXcodeLicense: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token) continue;
    if (token === "--profile") {
      const value = argv[i + 1];
      if (value === "core" || value === "docs" || value === "release") {
        parsed.profile = value;
        i += 1;
        continue;
      }
      throw new Error("--profile must be one of: core, docs, release");
    }
    if (token === "--require-cmd") {
      const value = argv[i + 1];
      if (!value) throw new Error("--require-cmd requires a value");
      parsed.requireCmd.push(value);
      i += 1;
      continue;
    }
    if (token === "--require-env") {
      const value = argv[i + 1];
      if (!value) throw new Error("--require-env requires a value");
      parsed.requireEnv.push(value);
      i += 1;
      continue;
    }
    if (token === "--check-xcode-license") {
      parsed.checkXcodeLicense = true;
      continue;
    }
    if (token === "--min-bun-version") {
      const value = argv[i + 1];
      if (!value) throw new Error("--min-bun-version requires a value");
      parsed.minBunVersion = value;
      i += 1;
      continue;
    }
    if (token === "--json-out") {
      const value = argv[i + 1];
      if (!value) throw new Error("--json-out requires a path");
      parsed.jsonOut = value;
      i += 1;
      continue;
    }
    if (token === "--md-out") {
      const value = argv[i + 1];
      if (!value) throw new Error("--md-out requires a path");
      parsed.mdOut = value;
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  return parsed;
}

function platformReleaseCommands(): string[] {
  if (process.platform === "darwin") {
    return ["xcodebuild", "pkgbuild", "productbuild", "hdiutil"];
  }
  if (process.platform === "linux") {
    return ["dpkg-deb", "appimagetool"];
  }
  if (process.platform === "win32") {
    return ["iscc"];
  }
  return [];
}

function commandsForProfile(profile: ProfileName): string[] {
  if (profile === "core") return ["bun", "git"];
  if (profile === "docs") return ["bun", "git", "python3"];
  return ["bun", "git", ...platformReleaseCommands()];
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function commandPath(commandName: string): string | null {
  const locator = process.platform === "win32" ? "where" : "which";
  const probe = spawnSync(locator, [commandName], { encoding: "utf8" });
  if (probe.status !== 0) return null;
  const output = `${probe.stdout || ""}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  return output ?? null;
}

function parseSemver(input: string): Semver | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(input.trim());
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  };
}

function compareSemver(a: Semver, b: Semver): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

function checkCommand(commandName: string): Check {
  const found = commandPath(commandName);
  if (!found) {
    return {
      id: `cmd:${commandName}`,
      kind: "command",
      target: commandName,
      status: "FAIL",
      message: `command not found: ${commandName}`,
      fixHint: `Install ${commandName} and ensure it is on PATH.`
    };
  }
  return {
    id: `cmd:${commandName}`,
    kind: "command",
    target: commandName,
    status: "PASS",
    message: `command found`,
    evidence: found
  };
}

function checkBunVersion(minVersion: string): Check {
  const run = spawnSync("bun", ["--version"], { encoding: "utf8" });
  const stdout = `${run.stdout || ""}`.trim();
  const stderr = `${run.stderr || ""}`.trim();

  if (run.status !== 0) {
    return {
      id: "bun:version",
      kind: "host",
      target: "bun",
      status: "FAIL",
      message: "unable to read Bun version",
      evidence: stderr || stdout
    };
  }

  const current = parseSemver(stdout);
  const required = parseSemver(minVersion);
  if (!current || !required) {
    return {
      id: "bun:version",
      kind: "host",
      target: "bun",
      status: "FAIL",
      message: `invalid semver comparison (current='${stdout}', required='${minVersion}')`
    };
  }

  if (compareSemver(current, required) < 0) {
    return {
      id: "bun:version",
      kind: "host",
      target: "bun",
      status: "FAIL",
      message: `bun version ${stdout} is below required ${minVersion}`,
      fixHint: `Upgrade Bun to >= ${minVersion}.`
    };
  }

  return {
    id: "bun:version",
    kind: "host",
    target: "bun",
    status: "PASS",
    message: `bun version ${stdout} satisfies >= ${minVersion}`
  };
}

function checkPythonXcodeBlocker(): Check | null {
  if (process.platform !== "darwin") return null;
  const pythonPath = commandPath("python3");
  if (!pythonPath) return null;

  const run = spawnSync("python3", ["--version"], { encoding: "utf8" });
  const combined = `${run.stdout || ""}\n${run.stderr || ""}`.toLowerCase();
  const blocked =
    combined.includes("xcode license") ||
    combined.includes("agree to the xcode") ||
    combined.includes("xcodebuild -license");

  if (!blocked) {
    return {
      id: "host:xcode-license-via-python3",
      kind: "host",
      target: "xcode-license",
      status: "PASS",
      message: "no Xcode license blocker detected via python3 probe"
    };
  }

  return {
    id: "host:xcode-license-via-python3",
    kind: "host",
    target: "xcode-license",
    status: "BLOCKED",
    message: "Xcode license is not accepted; python3-dependent checks will fail",
    fixHint: "Run `sudo xcodebuild -license` and accept terms, then rerun preflight.",
    evidence: `${run.stderr || run.stdout || ""}`.trim()
  };
}

function checkXcodeFirstLaunchStatus(): Check | null {
  if (process.platform !== "darwin") return null;
  const tool = commandPath("xcodebuild");
  if (!tool) {
    return {
      id: "host:xcodebuild-present",
      kind: "host",
      target: "xcodebuild",
      status: "FAIL",
      message: "xcodebuild not found on PATH",
      fixHint: "Install Xcode Command Line Tools."
    };
  }

  const run = spawnSync("xcodebuild", ["-checkFirstLaunchStatus"], { encoding: "utf8" });
  const combined = `${run.stdout || ""}\n${run.stderr || ""}`.toLowerCase();
  if (run.status === 0) {
    return {
      id: "host:xcode-first-launch",
      kind: "host",
      target: "xcodebuild",
      status: "PASS",
      message: "xcode first-launch status is complete"
    };
  }
  return {
    id: "host:xcode-first-launch",
    kind: "host",
    target: "xcodebuild",
    status: "BLOCKED",
    message: "xcode first-launch status is incomplete or blocked",
    fixHint: "Run `sudo xcodebuild -runFirstLaunch` (or complete CLT setup) and retry.",
    evidence: combined.trim()
  };
}

function checkEnvVar(name: string): Check {
  const value = process.env[name];
  if (value && value.length > 0) {
    return {
      id: `env:${name}`,
      kind: "env",
      target: name,
      status: "PASS",
      message: "environment variable is set"
    };
  }
  return {
    id: `env:${name}`,
    kind: "env",
    target: name,
    status: "FAIL",
    message: "environment variable is missing",
    fixHint: `Export ${name} before running dependent workflows.`
  };
}

function overallStatus(checks: Check[]): "PASS" | "FAIL" | "BLOCKED" | "MIXED" {
  const hasFail = checks.some((c) => c.status === "FAIL");
  const hasBlocked = checks.some((c) => c.status === "BLOCKED");
  if (!hasFail && !hasBlocked) return "PASS";
  if (hasFail && hasBlocked) return "MIXED";
  if (hasBlocked) return "BLOCKED";
  return "FAIL";
}

function ensureParentDir(filePath: string): void {
  const dir = path.dirname(path.resolve(filePath));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function toMarkdown(checks: Check[], profile: string, overall: string): string {
  const passCount = checks.filter((c) => c.status === "PASS").length;
  const failCount = checks.filter((c) => c.status === "FAIL").length;
  const blockedCount = checks.filter((c) => c.status === "BLOCKED").length;

  const lines: string[] = [];
  lines.push("# Host Prereq Preflight Report");
  lines.push("");
  lines.push(`Profile: ${profile}`);
  lines.push(`Platform: ${process.platform}`);
  lines.push(`Overall: ${overall}`);
  lines.push(`Counts: PASS=${passCount} FAIL=${failCount} BLOCKED=${blockedCount}`);
  lines.push("");
  lines.push("| Status | Kind | Target | Message | Fix |");
  lines.push("|---|---|---|---|---|");
  for (const check of checks) {
    lines.push(
      `| ${check.status} | ${check.kind} | ${check.target} | ${check.message.replace(/\|/g, "\\|")} | ${(check.fixHint || "").replace(/\|/g, "\\|")} |`
    );
  }
  return lines.join("\n");
}

function exitCodeForOverall(status: string): number {
  if (status === "PASS") return 0;
  if (status === "FAIL") return 2;
  if (status === "BLOCKED") return 3;
  return 4;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const checks: Check[] = [];
  const commands = unique([...commandsForProfile(args.profile), ...args.requireCmd]);
  for (const commandName of commands) {
    checks.push(checkCommand(commandName));
  }

  const minBun = args.minBunVersion || "1.3.9";
  if (commands.includes("bun")) {
    checks.push(checkBunVersion(minBun));
  }

  for (const envName of unique(args.requireEnv)) {
    checks.push(checkEnvVar(envName));
  }

  const shouldCheckXcode =
    process.platform === "darwin" &&
    (args.checkXcodeLicense || args.profile === "docs" || args.profile === "release");

  if (shouldCheckXcode) {
    const pythonLicense = checkPythonXcodeBlocker();
    if (pythonLicense) checks.push(pythonLicense);
    const firstLaunch = checkXcodeFirstLaunchStatus();
    if (firstLaunch) checks.push(firstLaunch);
  }

  const overall = overallStatus(checks);
  const passCount = checks.filter((c) => c.status === "PASS").length;
  const failCount = checks.filter((c) => c.status === "FAIL").length;
  const blockedCount = checks.filter((c) => c.status === "BLOCKED").length;

  for (const check of checks) {
    const prefix = `[${check.status}]`;
    const suffix = check.fixHint ? ` | fix: ${check.fixHint}` : "";
    console.log(`${prefix} ${check.kind}:${check.target} ${check.message}${suffix}`);
  }
  console.log(
    `[SUMMARY] profile=${args.profile} PASS=${passCount} FAIL=${failCount} BLOCKED=${blockedCount} overall=${overall}`
  );

  const payload = {
    generated_at: new Date().toISOString(),
    profile: args.profile,
    platform: process.platform,
    counts: {
      pass: passCount,
      fail: failCount,
      blocked: blockedCount
    },
    overall,
    checks
  };

  if (args.jsonOut) {
    ensureParentDir(args.jsonOut);
    writeFileSync(path.resolve(args.jsonOut), JSON.stringify(payload, null, 2), "utf8");
  }
  if (args.mdOut) {
    ensureParentDir(args.mdOut);
    writeFileSync(path.resolve(args.mdOut), toMarkdown(checks, args.profile, overall), "utf8");
  }

  process.exitCode = exitCodeForOverall(overall);
}

if (import.meta.main) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[host-prereq-preflight] FAIL: ${message}`);
    process.exitCode = 2;
  }
}
