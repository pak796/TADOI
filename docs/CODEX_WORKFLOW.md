# Codex Workflow

This guide adds repo-specific workflow rules on top of the existing Codex instruction stack and installed skills. It is not a replacement layer.

## Precedence

Use this order:

1. Codex system and developer instructions
2. Your direct task request
3. Installed or named skills triggered for the task
4. This repo workflow guide and the repo-level `AGENTS.md`

If this guide conflicts with a higher-priority instruction, the higher-priority instruction wins.

## Default Request Format

Use this short task frame when handing work to Codex:

- `Scope`: what outcome is in scope
- `Allowed files`: which paths Codex may edit
- `Do not touch`: protected files or folders
- `Validation`: exact commands Codex should run
- `Dataset impact`: `none`, `draft only`, or `production write`

Example:

```text
Scope: add a Codex task scaffold for TADOI release work
Allowed files: AGENTS.md, docs/**, scripts/codex/**, package.json
Do not touch: src/**, packaging/**, skills/**
Validation: node scripts/codex/preflight.mjs
Dataset impact: none
```

## Branching Rules

- Create a task branch before Codex writes code.
- Use `codex/<surface>/<task>` branch names.
- Keep one agent on one branch.
- When using multiple agents, split by owned path, not by vague responsibility.
- Keep workflow files single-owner during parallel work when possible.

Recommended splits:

- `codex/repo/<task>` for repo bootstrap, workflow scripts, and cross-surface changes
- `codex/docs/<task>` for docs-only work
- `codex/app/<task>` for runtime or packaging work
- `codex/ai/<task>` for memory, skill, or workflow-surface updates

## Skill Overlay

Keep the current Codex skills active. Add these repo-local defaults:

- `atomic-change-planner` for multi-surface work, risky workflow imports, or larger refactors
- `safe-scope-enforcer` for constrained tasks and before finalizing docs-only, workflow-only, or packaging-only changes
- `spec-task-drift-guard` after source-of-truth docs, versioned docs, or memory changes
- `session-handoff-capture` when a task stops midstream or changes hands
- `release-readiness-gate` before release, packaging, or installer work
- `keybind-source-of-truth` for keyboard, help, and QA key changes
- repo-local `host-prereq-preflight` before host-sensitive validation
- repo-local `documentation-audit-refresh` when the task is a docs-audit refresh

`playwright` and `develop-web-game` are intentionally not vendored here because `TADOI` is terminal-first and does not currently have a browser UI surface.

## `docs/ai` Context System

- Read `docs/ai/01-meta.yaml`, `docs/ai/02-system.yaml`, `docs/ai/03-structure.yaml`, and `docs/ai/04-memory.yaml` before starting repo work.
- Search those YAML files first for repo context before broader discovery.
- Treat `docs/ai` as the repo's AI context, structure, and memory system.
- After any file-editing job, review the impacted `docs/ai/*.yaml` files and update changed facts before finishing.
- Keep `docs/ai` entries short, factual, and easy to maintain.
- Update `docs/ai/05-update-tracker.md` only for meaningful changes.

## Task And Session Artifacts

Use `docs/codex/tasks/<date>-<slug>/` as the canonical task and session memory path.

Start new task docs with:

```bash
npm run codex:new-task -- --slug <slug> --title "<Title>"
```

That scaffold creates:

- `01-spec.md`
- `02-task-breakdown.md`
- `03-implementation-tracker.md`
- `04-change-summary.md`
- `05-session-handoff.md`

Reusable planning and checklist templates live under `docs/codex/templates/`.

Treat legacy `docs/handoff/**` files as historical notes only. Do not create new ad hoc `progress.md` or handoff files for future Codex work.

## Live Skills Versus Vendored Skills

- `skills/**` contains repo-owned live skills used directly by this repo.
- `ai/skills/**` contains repo-local vendored snapshots of grounded cross-repo skills.
- Treat vendored copies as portable references and repo assets, not as proof the active Codex runtime has installed them.
- Use `node scripts/codex/manage-skills.mjs` for vendored install or refresh workflows.
- When the vendored set changes, update `ai/skills/README.md` and `ai/skills/manifest.json`.

## Plan Before Code

For non-trivial work, fill the task spec and task breakdown before code changes begin.

Those task docs should lock:

- scope
- allowed files
- do-not-touch paths
- validation commands
- dataset impact
- acceptance criteria

Use the reusable templates or checklists in `docs/codex/templates/` when the task needs:

- feature spec structure
- acceptance criteria
- implementation tracking
- handoff notes
- review checklist coverage
- docs-update checks
- safe-scope and atomic-change checks
- release readiness checks

## Validation Rules

For workflow and bootstrap changes, use:

```bash
node scripts/codex/preflight.mjs
npm run codex:new-task -- --slug <slug> --title "<Title>" --dry-run
node scripts/codex/manage-skills.mjs list
```

For runtime code work, use:

```bash
bun run preflight:host:core
bun run test
bun run typecheck
```

For docs or keybind work, use:

```bash
bun run preflight:host:docs
bun run docs:lint
bun run keybind:canonical:check
```

For release and packaging work, use:

```bash
bun run preflight:host:release
bun run release:rc:check
```

Use narrower commands only when the task request explicitly limits scope.

## Artifact Rules

- Keep generated package artifacts, coverage output, and scratch notes out of normal commits.
- Keep new task and session notes under `docs/codex/tasks/**`, not as new repo-root or workspace-local journals.
- If a generated artifact must be committed, call that out in the task request and final summary.
