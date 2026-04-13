---
name: spec-task-drift-guard
description: Detect and report drift between documentation claims and repository behavior by verifying docs against code/config/tests. Use when specs, task lists, README, QA guides, or release docs may be stale, contradictory, or unverifiable.
---

# Spec/Task Drift Guard

Run a deterministic docs-vs-code drift scan and produce findings that are safe to action.

## Workflow

1. Confirm scope and collect docs and code globs.
2. Run `scripts/doc_drift_scan.py` to extract claims from docs and verify evidence in code/config/tests.
3. Classify findings into `verified`, `unverified`, or `missing_evidence`.
4. Mark `requires_code_change` only when the gap cannot be fixed by docs alone.
5. Output both JSON and Markdown reports and summarize highest-severity drift first.

## Required Inputs

- Repository root (`--repo-root`)
- One or more documentation globs (`--doc-glob` repeated)
- One or more code/config/test globs (`--code-glob` repeated)
- Output paths (`--out-json`, `--out-md`)

## Command

```bash
python3 "$CODEX_HOME/skills/spec-task-drift-guard/scripts/doc_drift_scan.py" \
  --repo-root . \
  --doc-glob "README.md" \
  --doc-glob "docs/**/*.md" \
  --doc-glob "*_SPEC_*.md" \
  --doc-glob "*_TASKS_*.md" \
  --code-glob "src/**/*" \
  --code-glob "scripts/**/*" \
  --code-glob "package.json" \
  --out-json /tmp/doc_drift_findings.json \
  --out-md /tmp/doc_drift_findings.md
```

## Decision Rules

- Treat CLI flags, keybinds, file paths, and workflow steps as high-value claims.
- Use exact or normalized token matches for verification.
- If no evidence is found, do not guess. Emit `missing_evidence`.
- If a claim appears plausible but not provable from repo state, emit `unverified`.
- If docs cannot be corrected without changing implementation, set `requires_code_change: true`.

## Fallback Behavior

- If globs match no files, report explicitly and stop.
- If claim parsing is partial, keep raw claim text and mark severity `medium`.
- If source files are unreadable, include a finding with recommendation to fix permissions/path.

## Output Contract

JSON finding fields:

- `id`
- `severity`
- `doc_path`
- `evidence_paths`
- `claim`
- `status`
- `requires_code_change`
- `recommendation`

Markdown output must include summary counts and a severity-sorted table.

## References

- Claim extraction and matching rules: `references/matching-rules.md`
- Reporting schema and examples: `references/output-schema.md`
