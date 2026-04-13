export type TadoiInvocation = {
  command: string;
  baseArgs: string[];
};

function basenameLower(value: string): string {
  const normalized = value.replaceAll("\\", "/");
  const index = normalized.lastIndexOf("/");
  return (index >= 0 ? normalized.slice(index + 1) : normalized).toLowerCase();
}

function isInterpreterExecutable(value: string | undefined): boolean {
  if (!value) return false;
  const base = basenameLower(value);
  return (
    base === "node" ||
    base === "node.exe" ||
    base === "bun" ||
    base === "bun.exe"
  );
}

function isLikelyScriptPath(value: string | undefined): value is string {
  if (!value) return false;
  const lowered = value.toLowerCase();
  return (
    lowered.endsWith(".js") ||
    lowered.endsWith(".mjs") ||
    lowered.endsWith(".cjs") ||
    lowered.endsWith(".ts") ||
    lowered.endsWith(".tsx")
  );
}

export function resolveCurrentTadoiInvocation(
  argv = process.argv,
  execPath = process.execPath,
): TadoiInvocation {
  const command = execPath || argv[0] || "tadoi";
  const scriptArg = argv[1];

  if (isLikelyScriptPath(scriptArg)) {
    return {
      command,
      baseArgs: [scriptArg],
    };
  }

  if (argv[0] && argv[0] !== process.execPath) {
    return {
      command: argv[0],
      baseArgs: [],
    };
  }

  if (!isInterpreterExecutable(command)) {
    return {
      command,
      baseArgs: [],
    };
  }

  return {
    command: "tadoi",
    baseArgs: [],
  };
}

function quoteForPosix(value: string): string {
  if (value.length === 0) return "''";
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function quoteForWindowsArg(value: string): string {
  if (value.length === 0) return '""';
  if (!/[\s"]/u.test(value)) {
    return value;
  }

  let escaped = '"';
  let backslashes = 0;
  for (const char of value) {
    if (char === "\\") {
      backslashes += 1;
      continue;
    }
    if (char === '"') {
      escaped += "\\".repeat(backslashes * 2 + 1);
      escaped += '"';
      backslashes = 0;
      continue;
    }
    escaped += "\\".repeat(backslashes);
    escaped += char;
    backslashes = 0;
  }
  escaped += "\\".repeat(backslashes * 2);
  escaped += '"';
  return escaped;
}

export function buildShellCommandLine(
  parts: string[],
  platform: NodeJS.Platform,
): string {
  if (platform === "win32") {
    return parts.map(quoteForWindowsArg).join(" ");
  }
  return parts.map(quoteForPosix).join(" ");
}
