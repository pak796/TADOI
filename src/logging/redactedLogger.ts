import path from "path";
import { redactPathForDisplay } from "../app/pathRedaction";

type ConsoleLike = Pick<Console, "log" | "warn" | "error" | "debug">;

const SENSITIVE_KEY_PATTERN = /token|secret|passphrase|password|authorization|cookie|api[-_]?key/i;
const INLINE_SECRET_PATTERN = /\b(gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_]{20,})\b/g;
const PATH_TOKEN_PATTERN = /^([("'[{<]*)(.*?)([)"'\]}>:;,!?]*)$/;
const WINDOWS_ABSOLUTE_PATTERN = /^[A-Za-z]:[\\/]/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAbsolutePathLike(value: string): boolean {
  return path.isAbsolute(value) || WINDOWS_ABSOLUTE_PATTERN.test(value);
}

function redactAbsolutePathLike(value: string): string {
  if (WINDOWS_ABSOLUTE_PATTERN.test(value) && !path.isAbsolute(value)) {
    const normalized = value.replaceAll("\\", "/");
    const base = normalized.split("/").filter(Boolean).at(-1);
    return base ? `~/.../${base}` : "~/...";
  }
  return redactPathForDisplay(value);
}

function redactTokenForPaths(token: string): string {
  const match = token.match(PATH_TOKEN_PATTERN);
  if (!match) return token;
  const [, prefix, core, suffix] = match;
  if (!core || !isAbsolutePathLike(core)) {
    return token;
  }
  return `${prefix}${redactAbsolutePathLike(core)}${suffix}`;
}

function redactString(value: string): string {
  const withoutInlineSecrets = value.replace(INLINE_SECRET_PATTERN, "[REDACTED]");
  return withoutInlineSecrets
    .split(/(\s+)/)
    .map((part) => (part.trim().length > 0 ? redactTokenForPaths(part) : part))
    .join("");
}

function redactUnknown(
  value: unknown,
  seen: WeakSet<object>,
  depth: number
): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactString(value);
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return value;
  }
  if (typeof value === "symbol") return String(value);
  if (typeof value === "function") return `[Function ${value.name || "anonymous"}]`;

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
      ...(value.stack ? { stack: redactString(value.stack) } : {})
    };
  }

  if (depth >= 5) {
    return "[Truncated]";
  }

  if (Array.isArray(value)) {
    return value.slice(0, 40).map((entry) => redactUnknown(entry, seen, depth + 1));
  }

  if (!isRecord(value)) {
    return String(value);
  }
  if (seen.has(value)) {
    return "[Circular]";
  }
  seen.add(value);

  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      output[key] = "[REDACTED]";
      continue;
    }
    output[key] = redactUnknown(entry, seen, depth + 1);
  }
  return output;
}

export function redactLogValue(value: unknown): unknown {
  return redactUnknown(value, new WeakSet<object>(), 0);
}

export function createRedactedLogger(consoleLike: ConsoleLike = console) {
  const emit = (method: "log" | "warn" | "error" | "debug", args: unknown[]): void => {
    const target = consoleLike[method] ?? consoleLike.log;
    target(...args.map((arg) => redactLogValue(arg)));
  };

  return {
    log: (...args: unknown[]) => emit("log", args),
    warn: (...args: unknown[]) => emit("warn", args),
    error: (...args: unknown[]) => emit("error", args),
    debug: (...args: unknown[]) => emit("debug", args)
  };
}

export const redactedLogger = createRedactedLogger();
