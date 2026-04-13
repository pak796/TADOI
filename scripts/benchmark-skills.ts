import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import os from "node:os";

type DimensionScores = {
  trigger_precision: number;
  workflow_completeness: number;
  determinism_automation: number;
  safety_guardrails: number;
  reusability_maintainability: number;
  total: number;
};

type SkillTarget = {
  name: string;
  path: string;
};

type SkillEval = {
  skill: string;
  path: string;
  line_count: number;
  has_scripts: boolean;
  has_references: boolean;
  has_assets: boolean;
  has_openai: boolean;
  scores: DimensionScores;
};

type Args = {
  baselineJson: string;
  outJson: string;
  outMd: string;
  skillTargets: SkillTarget[];
};

function parseArgs(argv: string[]): Args {
  const home = os.homedir();
  const defaults: SkillTarget[] = [
    {
      name: "host-prereq-preflight",
      path: path.resolve("skills/host-prereq-preflight"),
    },
    {
      name: "find-skills",
      path: path.join(home, ".codex", "skills", "find-skills"),
    },
    {
      name: "writing-clearly-and-concisely",
      path: path.join(
        home,
        ".codex",
        "skills",
        "writing-clearly-and-concisely",
      ),
    },
  ];

  const args: Args = {
    baselineJson: path.resolve(
      "docs/skills/data/benchmark_scores_2026-02-11.json",
    ),
    outJson: "",
    outMd: "",
    skillTargets: defaults,
  };

  const customTargets: SkillTarget[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token) continue;

    if (token === "--baseline-json") {
      const value = argv[i + 1];
      if (!value) throw new Error("--baseline-json requires a value");
      args.baselineJson = path.resolve(value);
      i += 1;
      continue;
    }

    if (token === "--out-json") {
      const value = argv[i + 1];
      if (!value) throw new Error("--out-json requires a value");
      args.outJson = path.resolve(value);
      i += 1;
      continue;
    }

    if (token === "--out-md") {
      const value = argv[i + 1];
      if (!value) throw new Error("--out-md requires a value");
      args.outMd = path.resolve(value);
      i += 1;
      continue;
    }

    if (token === "--skill") {
      const value = argv[i + 1];
      if (!value) throw new Error("--skill requires <name>=<path>");
      const split = value.indexOf("=");
      if (split === -1)
        throw new Error("--skill must be formatted as <name>=<path>");
      const name = value.slice(0, split).trim();
      const targetPath = path.resolve(value.slice(split + 1).trim());
      if (!name) throw new Error("skill name cannot be empty");
      customTargets.push({ name, path: targetPath });
      i += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  if (!args.outJson) throw new Error("--out-json is required");
  if (!args.outMd) throw new Error("--out-md is required");
  if (customTargets.length > 0) args.skillTargets = customTargets;
  return args;
}

function parseFrontmatterDescription(markdown: string): string {
  const match = /^---\n([\s\S]*?)\n---/.exec(markdown);
  if (!match) return "";
  const yaml = match[1];
  const descMatch = /^\s*description:\s*(.+)$/m.exec(yaml);
  if (!descMatch) return "";
  const raw = descMatch[1].trim();
  return raw.replace(/^['"]|['"]$/g, "");
}

function countMatches(text: string, pattern: RegExp): number {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

function clamp(maxValue: number, value: number): number {
  return Math.max(0, Math.min(maxValue, value));
}

function scoreTrigger(description: string, skillMd: string): number {
  let score = 0;
  if (description.length >= 24) score += 8;
  if (/use when|when users|trigger/i.test(description)) score += 6;
  if (/##\s+when to use|##\s+when to apply/i.test(skillMd)) score += 6;
  return clamp(20, score);
}

function scoreWorkflow(skillMd: string): number {
  let score = 0;
  if (/##\s+(deterministic workflow|workflow|runbook)/i.test(skillMd))
    score += 8;
  const stepCount = countMatches(skillMd, /^\d+\.\s+/gm);
  if (stepCount >= 3) score += 6;
  if (/##\s+output contract/i.test(skillMd)) score += 3;
  if (/fallback|guardrails|acceptance/i.test(skillMd)) score += 3;
  return clamp(20, score);
}

function scoreDeterminism(skillMd: string, scriptsPath: string): number {
  let score = 0;
  if (existsSync(scriptsPath)) score += 10;
  if (/```[\s\S]*--[a-z0-9-]+/i.test(skillMd)) score += 4;
  if (/\bPASS\b/i.test(skillMd) && /\bFAIL\b/i.test(skillMd)) score += 3;

  if (existsSync(scriptsPath)) {
    const files = listFiles(scriptsPath);
    const joined = files.map((file) => readFileSync(file, "utf8")).join("\n");
    if (/process\.exitCode|overall=PASS|overall=FAIL|BLOCKED/i.test(joined)) {
      score += 3;
    }
  }

  return clamp(20, score);
}

function scoreSafety(skillMd: string, scriptsPath: string): number {
  let score = 0;
  if (/##\s+guardrails|do not|never/i.test(skillMd)) score += 8;
  if (/prereq|preflight|auth|missing|blocked/i.test(skillMd)) score += 6;
  if (/\bBLOCKED\b|non-zero|exit code/i.test(skillMd)) score += 6;

  if (existsSync(scriptsPath)) {
    const files = listFiles(scriptsPath);
    const joined = files.map((file) => readFileSync(file, "utf8")).join("\n");
    if (/BLOCKED|fixHint|error|exitCodeForOverall/i.test(joined)) {
      score = clamp(20, score + 2);
    }
  }

  return clamp(20, score);
}

function scoreReuse(skillRoot: string, lineCount: number): number {
  let score = 0;
  if (existsSync(path.join(skillRoot, "agents", "openai.yaml"))) score += 8;
  if (existsSync(path.join(skillRoot, "scripts"))) score += 4;
  if (existsSync(path.join(skillRoot, "references"))) score += 4;
  if (lineCount >= 30 && lineCount <= 500) score += 4;
  return clamp(20, score);
}

function listFiles(root: string): string[] {
  const stack = [root];
  const files: string[] = [];

  while (stack.length > 0) {
    const current = stack.pop()!;
    const entries = safeReadDir(current);
    for (const entry of entries) {
      if (entry.isDirectory) {
        stack.push(entry.path);
      } else {
        files.push(entry.path);
      }
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

function safeReadDir(
  dirPath: string,
): Array<{ path: string; isDirectory: boolean }> {
  if (!existsSync(dirPath)) return [];
  const entries = readdirSync(dirPath, { withFileTypes: true });
  return entries.map((entry) => ({
    path: path.join(dirPath, entry.name),
    isDirectory: entry.isDirectory(),
  }));
}

function evaluateSkill(target: SkillTarget): SkillEval {
  const skillMdPath = path.join(target.path, "SKILL.md");
  if (!existsSync(skillMdPath)) {
    throw new Error(`SKILL.md not found: ${skillMdPath}`);
  }

  const skillMd = readFileSync(skillMdPath, "utf8");
  const description = parseFrontmatterDescription(skillMd);
  const lineCount = skillMd.split(/\r?\n/).length;
  const scriptsPath = path.join(target.path, "scripts");
  const referencesPath = path.join(target.path, "references");
  const assetsPath = path.join(target.path, "assets");

  const scores = {
    trigger_precision: scoreTrigger(description, skillMd),
    workflow_completeness: scoreWorkflow(skillMd),
    determinism_automation: scoreDeterminism(skillMd, scriptsPath),
    safety_guardrails: scoreSafety(skillMd, scriptsPath),
    reusability_maintainability: scoreReuse(target.path, lineCount),
    total: 0,
  };
  scores.total =
    scores.trigger_precision +
    scores.workflow_completeness +
    scores.determinism_automation +
    scores.safety_guardrails +
    scores.reusability_maintainability;

  return {
    skill: target.name,
    path: target.path,
    line_count: lineCount,
    has_scripts: existsSync(scriptsPath),
    has_references: existsSync(referencesPath),
    has_assets: existsSync(assetsPath),
    has_openai: existsSync(path.join(target.path, "agents", "openai.yaml")),
    scores,
  };
}

function ensureParentDir(filePath: string): void {
  const parent = path.dirname(filePath);
  if (!existsSync(parent)) mkdirSync(parent, { recursive: true });
}

function readBaselineMap(baselinePath: string): Map<string, DimensionScores> {
  if (!existsSync(baselinePath)) return new Map();
  const raw = readFileSync(baselinePath, "utf8");
  const parsed = JSON.parse(raw) as {
    scores?: { all?: Array<{ skill: string; scores: DimensionScores }> };
  };
  const map = new Map<string, DimensionScores>();
  for (const item of parsed.scores?.all || []) {
    map.set(item.skill, item.scores);
  }
  return map;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function toFixed2(value: number): number {
  return Number(value.toFixed(2));
}

function renderMarkdown(
  dateLabel: string,
  rows: SkillEval[],
  baselineMap: Map<string, DimensionScores>,
): string {
  const lines: string[] = [];
  lines.push(`# Skill Robustness Benchmark (${dateLabel})`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Skills scored: ${rows.length}`);
  lines.push(
    `- Average total score: ${toFixed2(average(rows.map((r) => r.scores.total)))}`,
  );

  const comparable = rows.filter((r) => baselineMap.has(r.skill));
  if (comparable.length > 0) {
    const deltaAvg = average(
      comparable.map(
        (r) => r.scores.total - (baselineMap.get(r.skill)?.total || 0),
      ),
    );
    lines.push(`- Average delta vs baseline: ${toFixed2(deltaAvg)}`);
  }

  lines.push("");
  lines.push("## Scores");
  lines.push("");
  lines.push(
    "| Skill | Trigger | Workflow | Determinism | Safety | Reuse | Total |",
  );
  lines.push("|---|---:|---:|---:|---:|---:|---:|");
  for (const row of rows) {
    const s = row.scores;
    lines.push(
      `| \`${row.skill}\` | ${s.trigger_precision} | ${s.workflow_completeness} | ${s.determinism_automation} | ${s.safety_guardrails} | ${s.reusability_maintainability} | ${s.total} |`,
    );
  }

  lines.push("");
  lines.push("## Delta Vs Baseline");
  lines.push("");
  lines.push("| Skill | Before | After | Delta |");
  lines.push("|---|---:|---:|---:|");
  for (const row of rows) {
    const before = baselineMap.get(row.skill);
    if (!before) {
      lines.push(`| \`${row.skill}\` | n/a | ${row.scores.total} | n/a |`);
      continue;
    }
    const delta = row.scores.total - before.total;
    const signed = delta > 0 ? `+${delta}` : `${delta}`;
    lines.push(
      `| \`${row.skill}\` | ${before.total} | ${row.scores.total} | ${signed} |`,
    );
  }

  return lines.join("\n");
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const baselineMap = readBaselineMap(args.baselineJson);
  const rows = args.skillTargets.map((target) => evaluateSkill(target));
  const now = new Date();
  const dateLabel = now.toISOString().slice(0, 10);

  const payload = {
    date: dateLabel,
    baseline_source: args.baselineJson,
    scored_skills: rows,
    deltas: rows.map((row) => {
      const before = baselineMap.get(row.skill);
      return {
        skill: row.skill,
        before_total: before?.total ?? null,
        after_total: row.scores.total,
        delta_total: before ? row.scores.total - before.total : null,
      };
    }),
  };

  ensureParentDir(args.outJson);
  writeFileSync(args.outJson, JSON.stringify(payload, null, 2), "utf8");

  ensureParentDir(args.outMd);
  writeFileSync(
    args.outMd,
    renderMarkdown(dateLabel, rows, baselineMap),
    "utf8",
  );

  for (const row of rows) {
    const baseline = baselineMap.get(row.skill);
    if (!baseline) {
      console.log(
        `[SCORE] ${row.skill} total=${row.scores.total} baseline=n/a`,
      );
      continue;
    }
    const delta = row.scores.total - baseline.total;
    const signed = delta > 0 ? `+${delta}` : `${delta}`;
    console.log(
      `[SCORE] ${row.skill} before=${baseline.total} after=${row.scores.total} delta=${signed}`,
    );
  }
  console.log(`[OUTPUT] json=${args.outJson}`);
  console.log(`[OUTPUT] md=${args.outMd}`);
}

if (import.meta.main) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[benchmark-skills] FAIL: ${message}`);
    process.exitCode = 1;
  }
}
