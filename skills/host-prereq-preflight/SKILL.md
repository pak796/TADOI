---
name: host-prereq-preflight
description: Deterministically check local host prerequisites before running release, docs, or automation gates. Use when commands may fail due to missing tools, missing env vars, or platform blockers like unaccepted Xcode license terms.
---

# Host Prerequisite Preflight

Run this before expensive workflows to fail fast on host blockers.

## When to Use

Use this skill when:
- a gate/check command fails unexpectedly on the host
- a workflow depends on local toolchains (Bun, Git, packaging tools)
- environment variables are required for a task
- macOS may be blocked by Xcode first-launch/license prerequisites

## Command

```bash
bun "${CODEX_HOME:-$HOME/.codex}/skills/host-prereq-preflight/scripts/host_preflight.ts" \
  --profile release \
  --require-env NOTION_TOKEN \
  --json-out /tmp/host_preflight.json \
  --md-out /tmp/host_preflight.md
```

Local repo development path:

```bash
bun skills/host-prereq-preflight/scripts/host_preflight.ts --profile release
```

## Profiles

- `core`: `bun`, `git`
- `docs`: `bun`, `git`, `python3` (+ Xcode gate on macOS)
- `release`: `bun`, `git`, plus platform packaging commands

Platform commands for `release`:
- macOS: `xcodebuild`, `pkgbuild`, `productbuild`, `hdiutil`
- Linux: `dpkg-deb`, `appimagetool`
- Windows: `iscc`

## Output Contract

The checker always emits:
- line-by-line `PASS` / `FAIL` / `BLOCKED` records
- summary line with counts and overall result
- optional JSON report when `--json-out` is provided
- optional Markdown report when `--md-out` is provided

Exit codes:
- `0`: all checks passed
- `2`: one or more `FAIL`, no `BLOCKED`
- `3`: one or more `BLOCKED`, no `FAIL`
- `4`: both `FAIL` and `BLOCKED` present

## Workflow

1. Run preflight with the smallest matching profile.
2. Add any required env checks using `--require-env`.
3. If output is `FAIL`, install/fix missing prerequisites and rerun.
4. If output is `BLOCKED`, resolve host policy blocker (for example Xcode license) and rerun.
5. Only proceed to expensive checks after overall `PASS`.

## Guardrails

- Never claim downstream gate success when preflight returns non-zero.
- Treat `BLOCKED` as actionable host state, not a flaky test result.
- Keep required command/env lists explicit in automation docs or scripts.
