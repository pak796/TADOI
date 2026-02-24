import { promises as fs } from "fs";
import path from "path";

type KeybindAuditPayload = {
  canonical_keybinds: string[];
  missing_in_docs: string[];
  missing_in_code: string[];
  semantic_mismatch: string[];
  evidence: {
    code: Record<string, string[]>;
    docs: Record<string, string[]>;
  };
};

type Options = {
  input: string;
  output: string;
  check: boolean;
};

function parseArgs(argv: string[]): Options {
  const options: Options = {
    input: "docs/audit/KEYBIND_AUDIT.json",
    output: "docs/KEYBINDS_CANONICAL.md",
    check: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === "--input" && next) {
      options.input = next;
      index += 1;
      continue;
    }
    if (token === "--output" && next) {
      options.output = next;
      index += 1;
      continue;
    }
    if (token === "--check") {
      options.check = true;
      continue;
    }
    if (token === "--help") {
      throw new Error(
        "Usage: bun scripts/generate-keybind-doc.ts [--input <json>] [--output <md>] [--check]"
      );
    }
    if (token.startsWith("--")) {
      throw new Error(`Unknown option: ${token}`);
    }
  }

  return options;
}

function normalizePathForDoc(value: string, repoRoot: string): string {
  const absolute = path.resolve(value);
  const relative = path.relative(repoRoot, absolute).replace(/\\/g, "/");
  if (!relative.startsWith("..")) {
    return relative;
  }
  return value.replace(/\\/g, "/");
}

function summarizeEvidence(evidence: string[], repoRoot: string): string {
  if (evidence.length === 0) return "-";
  const normalized = evidence.map((item) => normalizePathForDoc(item, repoRoot));
  const shown = normalized.slice(0, 3);
  const remainder = normalized.length - shown.length;
  const joined = shown.join("<br>");
  if (remainder <= 0) {
    return joined;
  }
  return `${joined}<br>+${String(remainder)} more`;
}

export function renderCanonicalKeybindDoc(
  payload: KeybindAuditPayload,
  repoRoot: string
): string {
  const lines: string[] = [
    "# Canonical Keybindings",
    "",
    "Generated from key router + action-bearing key router tests via:",
    "- `python3 scripts/keybind-sync-audit.py`",
    "- `bun scripts/generate-keybind-doc.ts`",
    "",
    `Canonical keybind count: ${String(payload.canonical_keybinds.length)}`,
    "",
    "| Key | Code Evidence |",
    "|---|---|"
  ];

  for (const key of payload.canonical_keybinds) {
    const evidence = summarizeEvidence(payload.evidence.code[key] ?? [], repoRoot);
    lines.push(`| \`${key}\` | ${evidence} |`);
  }

  lines.push("");
  return lines.join("\n");
}

async function loadAuditPayload(filePath: string): Promise<KeybindAuditPayload> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as KeybindAuditPayload;
}

export async function run(options: Options, repoRoot: string): Promise<number> {
  const inputPath = path.resolve(repoRoot, options.input);
  const outputPath = path.resolve(repoRoot, options.output);
  const payload = await loadAuditPayload(inputPath);
  const next = renderCanonicalKeybindDoc(payload, repoRoot);

  if (options.check) {
    let current = "";
    try {
      current = await fs.readFile(outputPath, "utf8");
    } catch {
      // File missing should fail check mode.
    }

    if (current !== next) {
      console.error(
        `[keybind-doc] FAIL: ${options.output} is out of date. ` +
          "Run: bun run keybind:canonical:update"
      );
      return 1;
    }
    console.log(`[keybind-doc] PASS: ${options.output} is up to date.`);
    return 0;
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, next, "utf8");
  console.log(`[keybind-doc] Wrote ${options.output}`);
  return 0;
}

async function main(): Promise<void> {
  try {
    const options = parseArgs(process.argv.slice(2));
    const exitCode = await run(options, process.cwd());
    process.exitCode = exitCode;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[keybind-doc] ${message}`);
    process.exitCode = 2;
  }
}

if (import.meta.main) {
  void main();
}
