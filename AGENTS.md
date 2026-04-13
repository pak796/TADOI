# Repo Workflow Defaults

This file supplements Codex's built-in instructions, installed skills, and any higher-priority user or developer guidance. It does not replace them.

If a higher-priority instruction or a named skill applies, follow that first. Use the rules below as repo-local defaults for this workspace.

## Skill Routing

- Keep the current Codex skill stack as the base layer.
- Additionally use `atomic-change-planner` when a task spans more than one repo surface, imports or restructures workflow or memory infrastructure, or carries non-trivial rollback risk.
- Use `safe-scope-enforcer` for `docs-only`, `tests-only`, `workflow-only`, `packaging-only`, or other explicitly constrained edits.
- Use `spec-task-drift-guard` after changes to source-of-truth specs, versioned docs, workflow docs, help text, or README guidance.
- Use `session-handoff-capture` when pausing a multi-step task or handing work to another agent or human.
- Use `release-readiness-gate` before release, packaging, or installer work.
- Use `keybind-source-of-truth` for keyboard, help, or QA keybind changes.
- Use repo-local `host-prereq-preflight` before host-sensitive validation or release gates.
- Use repo-local `documentation-audit-refresh` for docs-audit refresh work.

## `docs/ai` Context System

- Before starting repo work, read `docs/ai/01-meta.yaml`, `docs/ai/02-system.yaml`, `docs/ai/03-structure.yaml`, and `docs/ai/04-memory.yaml`.
- Search those YAML files first for task context before broader repo discovery.
- Treat `docs/ai` as the repo's AI context, structure, and memory system.
- Use `docs/codex/tasks/<date>-<slug>/` for task and session memory created during repo work.
- After any file-editing job, review the impacted `docs/ai/*.yaml` files and update changed facts before finishing to prevent drift.
- Keep `docs/ai` entries short, factual, and easy to maintain.
- Update `docs/ai/05-update-tracker.md` only for meaningful changes.
- Treat existing `docs/handoff/**` files as historical notes only. Do not create new ad hoc handoff or progress files for future Codex work.

## Branching And Agent Ownership

- Do not commit directly to `master` for Codex implementation work.
- Create a task branch first using `codex/<surface>/<task>`.
- Prefer `codex/docs/<task>` for docs or workflow work.
- Prefer `codex/app/<task>` for runtime work.
- Prefer `codex/repo/<task>` for tooling or cross-surface work.
- Use one Codex agent per branch.
- Give each agent an explicit file ownership boundary.
- Split concurrent work by owned path, not by vague responsibility.

## Prompt Contract

- Include `Scope`.
- Include `Allowed files`.
- Include `Do not touch`.
- Include `Validation`.
- Include `Dataset impact`.

## Validation Defaults

- For workflow, memory, or repo-tooling changes, default to `node scripts/codex/preflight.mjs`, `npm run codex:new-task -- --slug <slug> --title "<Title>" --dry-run`, and `node scripts/codex/manage-skills.mjs list`.
- For runtime code changes, default to `bun run preflight:host:core`, `bun run test`, and `bun run typecheck`.
- For docs, help, or keybind work, default to `bun run preflight:host:docs` and `bun run docs:lint`; add `bun run keybind:canonical:check` when keyboard docs or help text changed.
- For release or packaging work, default to `bun run preflight:host:release` and `bun run release:rc:check` unless the task request declares a narrower gate.

## Skill Snapshot Safety

- Treat `ai/skills/**` as vendored reference snapshots, not proof that the active Codex runtime has those skills installed.
- Use `node scripts/codex/manage-skills.mjs` for repo-owned vendored skill install or refresh workflows instead of ad hoc copy commands.
- When the vendored skill set changes, update `ai/skills/README.md` and `ai/skills/manifest.json` with source and grounding evidence.
- Keep repo-owned live skills in `skills/**`.
- Ask before destructive rewrites of vendored skill snapshots or generated historical docs.

## Artifact Hygiene

- Do not commit generated build output, coverage, packaged artifacts, or scratch logs unless the task explicitly requires them.
- Keep task and session notes under `docs/codex/tasks/**`.
- Keep generated browser or package smoke artifacts out of normal commits unless the task explicitly requires them.
