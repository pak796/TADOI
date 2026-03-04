# TADOI Engineering Stats Log

Generated: **2026-03-03** (America/Chicago)
Baseline: **v0.3.9**

## 1) Measurement Method

This report is based on the current repository snapshot and uses deterministic counting scripts.

Assumptions used for metrics:
- Code files: tracked `*.ts`, `*.tsx`, `*.js`, `*.py`, `*.sh`
- Test files: paths in `test/` or filenames with `.test` / `.spec`
- Function counts: named function declarations + class methods + named variable-assigned functions (`const x = () => {}`); anonymous inline callbacks are excluded
- Test-case count: calls to `it(...)` / `test(...)` (including `.only`, `.skip`, `.todo`, `.concurrent` variants)

Primary code scope for engineering stats (`core scope`):
- Included: `src/`, `scripts/`, `bin/`, `packaging/`, `skills/`, `test/`
- Excluded: generated/runtime directories like `dist/`, `dist.prepack*`, `node_modules/`, `coverage/`

## 2) Snapshot Summary

| Metric | Value |
|---|---:|
| Git-tracked files (entire repo) | 661 |
| Markdown docs (`.md`) | 113 |
| Files in core scope | 365 |
| Code files in core scope | 335 |
| Production code files (core) | 187 |
| Test code files (core) | 148 |
| Total LOC (core code) | 100,485 |
| Non-empty LOC (core code) | 91,833 |
| Production LOC (core code) | 67,366 |
| Test LOC (core code) | 33,119 |
| Test-to-prod LOC ratio | 49.2% |
| Named function-like definitions (core total) | 2,321 |
| Named function-like definitions (prod only) | 2,067 |
| Named function-like definitions (tests only) | 254 |
| Test cases (`it` / `test`) | 1,215 |
| `describe(...)` blocks | 232 |
| Theme IDs available | 31 |
| Release tasks marked `Complete` in `TADOI_TASKS_v0.3.9.md` | 56 |

## 3) Scope Delta (Core vs Full Tracked Code)

Including tracked prepack build artifacts changes code volume materially:

| Metric | Core Scope | Full Tracked Code Files |
|---|---:|---:|
| Code files | 335 | 480 |
| Total LOC | 100,485 | 142,883 |
| Named function-like definitions | 2,321 | 3,321 |
| Test files | 148 | 212 |
| Test cases (`it` / `test`) | 1,215 | 1,693 |

Interpretation:
- The generated/prepack layer contributes **145 files**, **42,398 LOC**, and **1,000 additional function-like definitions**.
- For implementation health tracking, core scope is the better signal.

## 4) Module Density (Core `src/*`)

Sorted by non-empty LOC.

| Module | Files | Test Files | Non-empty LOC | Function-like defs | Test Cases |
|---|---:|---:|---:|---:|---:|
| `src/app` | 47 | 24 | 27,150 | 695 | 223 |
| `src/state` | 26 | 14 | 12,792 | 219 | 179 |
| `src/components` | 33 | 12 | 9,245 | 155 | 79 |
| `src/domain` | 62 | 29 | 8,702 | 299 | 208 |
| `src/notes` | 25 | 11 | 4,696 | 171 | 47 |
| `src/commands` | 14 | 5 | 4,602 | 64 | 46 |
| `src/cli` | 17 | 9 | 4,087 | 65 | 95 |
| `src/reminders` | 16 | 7 | 2,782 | 96 | 45 |
| `src/calendar` | 12 | 6 | 2,269 | 92 | 24 |
| `src/theme` | 11 | 7 | 2,026 | 26 | 65 |

Interpretation:
- Most complexity sits in `app`, `state`, `domain`, and `components`.
- `state` and `domain` have comparatively strong test density.
- `commands` + `cli` together are a large product surface (human-facing syntax + automation behavior).

## 5) Feature Analysis (Implemented Capability Surface)

This section summarizes what TADOI can do right now, based on `README`, v0.3.9 spec/task docs, and source module structure.

### 5.1 Core Task Management
- Full CRUD lifecycle: create, edit, duplicate, complete/reopen, and delete tasks.
- Rich task metadata: due date/time, tags, notes, priority, assignee, project, workflow stage.
- Checklist/subtask operations (`check add/toggle/edit/del/clear`) make tasks actionable at sub-item granularity.

### 5.2 Keyboard-First Interaction Model
- Explicit mode system (`LIST`, `DASHBOARD`, `ADD`, `EDIT`, `SEARCH`, `TAG_FILTER`, `HELP`, `BACKUP_CENTER`, `MODAL_CONFIRM`).
- Deterministic routing priority prevents keybind leakage across overlays and text-entry contexts.
- Terminal guardrail for unsupported viewport sizes (`104x24` minimum), reducing broken-layout states.

### 5.3 Advanced Filtering + Saved Views
- Filters across status, due buckets, priority, tags, and full boolean tag logic (`ALL/ANY/NONE`).
- Search lifecycle supports fast filter refinement without state loss after close.
- Saved views persist both list filters and dashboard analytics context (`analyticsWindow`, `dueDayOffset`, dimension slices).

### 5.4 Recurrence Engine
- Structured recurrence model (`dtstart`, `rrule`, `exdates`, `series_id`) with sparse materialization.
- Occurrence-level actions (complete, skip, snooze, edit one occurrence) and series-level editing.
- Recurrence-aware rendering parity across list and dashboard, enabling planning + reporting without desync.

### 5.5 Dashboard and Operational Analytics
- KPI strip (`OVERDUE`, `TODAY`, `NEXT{7|14|30}`, `OPEN`, `DONE{7|14|30}D`).
- Drill-through widgets: due buckets (`OVD`, `TOD`, `+1..+6`), top tags, priority strip, assignee/project/stage slices.
- Trend and throughput panels support horizon-based planning (`7d`, `14d`, `30d`) and backlog movement tracking.
- Keyboard focus-group navigation makes the dashboard fully operable without mouse dependence.

### 5.6 Command Layer (TITS) + CLI Parity
- Shared command grammar powers in-app command bar and external CLI wrapper.
- Command families include `add`, `done`, `due`, `recur`, `check`, `bulk`, `note`, `tag`, and `help`.
- Bulk operations support multi-task mutation for tags, due dates, priority, assignee, project, stage, and delete.
- CLI has explicit interactive/non-interactive routing, JSON output, quiet mode, and strong exit-code contracts.

### 5.7 TOME Notes System
- Integrated markdown knowledge layer (`note new/open/search/delete/reindex/root set/restore-defaults`).
- Quick-capture flows (`capture`, `nq`) and task-note linking allow action context to stay attached to work items.
- Default guide seeding and restore behavior help keep notes discoverable for new users.

### 5.8 Tag Hygiene and Taxonomy Maintenance
- Tag admin commands include rename, merge, hygiene, and cleanup (with dry-run support).
- This provides real taxonomy governance, not just raw tag assignment.

### 5.9 Data Safety, Backup, and Portability
- Local-first JSON persistence with schema migration and strict validation.
- Corrupt-state recovery writes timestamped `.corrupt.*` artifacts for forensics and rollback.
- In-app Backup Center enforces dry-run-first import and typed confirmation for destructive replace operations.

### 5.10 Calendar Interoperability (ICS)
- Export supports range/view/privacy controls and recurrence-aware event emission.
- Import supports `merge`, `update`, and `create` modes with dry-run and report options.
- Recurrence overrides/cancellations are handled with bounded expansion/horizon protections.
- Calendar flows are available in both CLI and guided in-app UX.

### 5.11 Notifications and Reminder Automation
- Tiered notification model: in-app modal queue, terminal bell cooldown, OS notifier scaffold.
- Out-of-app reminder scheduler can be installed/uninstalled/status-tested via CLI.
- Reminder index + helper state reduces duplicate fire and improves reliability across sessions.
- Engagement toasts track behavior milestones (first wins, streaks, recurring adoption, checklist adoption).

### 5.12 Security and Privacy Controls
- Non-HTTP link policy (`prompt` or `block`) gives operators control over risky opens.
- Unknown schemes and path/file targets are explicitly guarded before launch.
- Startup path logging is redacted by default, with opt-in verbose path diagnostics.

### 5.13 Theme, Visual Accessibility, and UX Surface
- 31 theme IDs including CRT variants, accessibility-oriented palettes, and rotating mode.
- CRT FX profile system allows runtime tuning of tint/flicker intensity.
- Left-rail branding/hint surface and menu entries are tightly integrated with keyboard discoverability.

### 5.14 Cloud Backup Integration (GitHub CLI Path)
- Snapshot manifesting, hashing, and optional encryption support exist in backup layer.
- Designed for auditable state/settings snapshots with metadata (`appVersion`, schema, counts, hashes).

## 6) Practical Readout: What Makes TADOI Impressive

TADOI is not only a TUI todo list. In current form, it behaves like a terminal-native personal operations platform with:
- A strict keyboard-driven operating model.
- A shared human/automation command language (TITS + CLI parity).
- Recurrence-aware planning and analytics.
- Built-in markdown knowledge capture (TOME).
- Production-minded safety mechanisms (dry-run gates, migration controls, lock handling, import confirmations, redacted logging).

That combination is unusual for terminal task tools and gives TADOI a strong foundation for both solo productivity and scripted workflows.

## 7) Evidence Sources

- `README.md`
- `docs/TADOI_Feature_List_v0.3.9.md`
- `TADOI_SPEC_v0.3.9.md`
- `TADOI_TASKS_v0.3.9.md`
- `src/commands/parse.ts`
- `src/cli/main.ts`
- `src/cli/calendarCommands.ts`
- `src/cli/remindersCommands.ts`
- `src/backup/githubCli.ts`
- `src/theme/themes.ts`
