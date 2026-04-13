# Codex Workflow Artifacts

## What lives in `docs/ai`

`docs/ai/01-05` is the durable project-memory layer.

- `01-meta.yaml` tracks repo metadata and workflow contract.
- `02-system.yaml` maps the current system and repo surfaces.
- `03-structure.yaml` maps the repo layout and placement rules.
- `04-memory.yaml` holds compact working memory, risks, and lessons.
- `05-update-tracker.md` records only high-signal repo changes.

Use `docs/ai` for persistent repo facts that should survive across tasks and sessions. Keep entries short, factual, and easy to refresh.

## What lives in `docs/codex/tasks`

`docs/codex/tasks/<date>-<slug>/` is the canonical task and session memory layer.

Use that path for work-in-progress specs, task breakdowns, implementation trackers, change summaries, and handoff notes that belong to one task instead of the whole repo.

Start new task docs with:

```bash
npm run codex:new-task -- --slug <slug> --title "<Title>"
```

The scaffold creates:

- `01-spec.md`
- `02-task-breakdown.md`
- `03-implementation-tracker.md`
- `04-change-summary.md`
- `05-session-handoff.md`

Treat existing `docs/handoff/**` files as historical records. Do not create new ad hoc handoff or progress files for future Codex work.

## What lives in `skills`

`skills/` is the repo-owned live skill layer.

Use that path for TADOI-specific skills that are maintained inside this repo and can include scripts or agent definitions.

## What lives in `ai/skills`

`ai/skills/` is the repo-local vendored skill snapshot layer.

Use that path for portable copies of grounded cross-repo skills plus provenance records. Treat these copies as repo assets and references, not as proof the active Codex runtime has installed them.

Use the repo-owned skill manager for install or refresh workflows:

```bash
npm run codex:skills -- list
npm run codex:skills -- install --dry-run
npm run codex:skills -- install --target "/absolute/path/to/skills-root" --write
npm run codex:skills -- sync-from-source --dry-run
```

When the vendored set changes, update `ai/skills/README.md` and `ai/skills/manifest.json`.

## How to start, track, hand off, and close Codex work

1. Create a task branch with the repo naming rule, usually `codex/<surface>/<task>`.
2. Optionally run `node scripts/codex/preflight.mjs` to print branch, status, prompt-contract, and artifact-path reminders.
3. Scaffold task docs in `docs/codex/tasks/<date>-<slug>/`.
4. Fill the task spec and task-breakdown docs before code for non-trivial work.
5. Track active decisions, validation, blockers, and next steps in the implementation tracker while working.
6. Use the reusable templates and checklists in `docs/codex/templates/` when you need acceptance criteria, review, docs-update, scope, or release guidance.
7. Write the change summary when work lands, and write the session handoff if the task pauses or changes hands.
8. Update `docs/ai/*` only when durable repo facts changed.
9. Update `ai/skills/README.md` and `ai/skills/manifest.json` when the vendored skill set or install workflow changed.
