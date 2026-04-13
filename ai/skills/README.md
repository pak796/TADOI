# Vendored Skill Snapshots

This directory stores repo-local snapshots of the cross-repo skills that are actively used in `guttenburg` and `VWA AIRPORT` and are relevant to `TADOI`.

These files are portable references and repo assets. They are not proof that the active Codex runtime has these skills installed.

Use the repo-owned skill manager for deterministic list, install, and refresh workflows:

```bash
npm run codex:skills -- list
npm run codex:skills -- install --dry-run
npm run codex:skills -- install --target "/absolute/path/to/skills-root" --write
npm run codex:skills -- sync-from-source --dry-run
```

## Included Set

- `atomic-change-planner`
- `brainstorming`
- `release-readiness-gate`
- `safe-scope-enforcer`
- `session-handoff-capture`
- `spec-task-drift-guard`

Not vendored here:

- `playwright`: not relevant to the current terminal-first `TADOI` surface.
- `develop-web-game`: not relevant to `TADOI`.
- `host-prereq-preflight` and `documentation-audit-refresh`: already owned live in `skills/**`.

## Provenance

- `atomic-change-planner`
  - Source: `../guttenburg/ai/skills/atomic-change-planner`
  - Grounded by: `guttenburg/AGENTS.md`, `guttenburg/docs/CODEX_WORKFLOW.md`, `VWA AIRPORT/AGENTS.md`, `VWA AIRPORT/docs/CODEX_WORKFLOW.md`
- `brainstorming`
  - Source: `../guttenburg/ai/skills/brainstorming`
  - Grounded by: `guttenburg/ai/skills/README.md`, `VWA AIRPORT/PlugNPlay/progress.md`
- `release-readiness-gate`
  - Source: `../guttenburg/ai/skills/release-readiness-gate`
  - Grounded by: `guttenburg/AGENTS.md`, `guttenburg/docs/CODEX_WORKFLOW.md`, `VWA AIRPORT/docs/codex/codex-capability-audit.md`
- `safe-scope-enforcer`
  - Source: `../guttenburg/ai/skills/safe-scope-enforcer`
  - Grounded by: `guttenburg/AGENTS.md`, `guttenburg/docs/CODEX_WORKFLOW.md`, `VWA AIRPORT/AGENTS.md`, `VWA AIRPORT/docs/CODEX_WORKFLOW.md`
- `session-handoff-capture`
  - Source: `../guttenburg/ai/skills/session-handoff-capture`
  - Grounded by: `guttenburg/AGENTS.md`, `guttenburg/docs/CODEX_WORKFLOW.md`, `VWA AIRPORT/AGENTS.md`, `VWA AIRPORT/docs/CODEX_WORKFLOW.md`
- `spec-task-drift-guard`
  - Source: `../guttenburg/ai/skills/spec-task-drift-guard`
  - Grounded by: `guttenburg/AGENTS.md`, `guttenburg/docs/CODEX_WORKFLOW.md`, `VWA AIRPORT/AGENTS.md`, `VWA AIRPORT/docs/CODEX_WORKFLOW.md`

## Maintenance

- Update this file when the vendored skill set changes.
- Update `ai/skills/manifest.json` when the vendored skill set changes.
- Keep source paths and grounding evidence explicit.
- If a vendored skill is refreshed from a newer source snapshot, record the change in `docs/ai/05-update-tracker.md` when it materially affects repo workflow.
