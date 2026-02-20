# TADOI™ Product Spec (v0.3.7)

Updated: 2026-02-20
Runtime baseline: `v0.3.7`
Package baseline: `0.3.7`
Persistence schema baseline: `5`

Stability taxonomy:
- `Canonical`: compatibility contract expected to remain stable across patch/minor updates.
- `Current Behavior (May Change)`: documented runtime behavior that may evolve without migration.

## 1) Product Definition

TADOI is a keyboard-first terminal task manager focused on fast personal execution workflows.

Core experience:
- List-first task management with strong keyboard routing and clear mode boundaries.
- TIT command layer (Milestones 1-3): in-app command bar, shared command engine, CLI parity, and recurrence command support.
- Recurrence-aware planning with occurrence-level actions.
- Unified filtering across list and dashboard analytics surfaces.
- Local-first persistence with explicit import/export safety controls.

## 2) Runtime Contracts

### 2.1 Terminal and Layout
- Minimum supported terminal size: `104x24`.
- When below minimum, app blocks interactions and shows:
  - `Terminal too small (min 104x24)`.
- On resize back to supported size, interaction resumes without restart.

### 2.2 Mode and Focus Boundaries
Primary modes:
- `LIST`
- `DASHBOARD`
- `ADD`
- `EDIT`
- `SEARCH`
- `TAG_FILTER`
- `HELP`
- `BACKUP_CENTER`
- `MODAL_CONFIRM`

Routing priorities:
1. modal handling (blocking)
2. TIT command bar handling when active (list mode only)
3. help/back subpage handling
4. search/editor text contexts
5. list/dashboard actions

### 2.3 Search Lifecycle
- `/` opens search.
- `Enter` or `Esc` closes search.
- Active search text remains in filter state after close.

### 2.4 Tag Filtering Contract
TADOI supports two tag flows:
- Legacy cycle (`t`): single tag include across open-task tags.
- Boolean panel (`p`): `ALL` / `ANY` / `NONE` buckets.

Precedence rule:
- Non-empty boolean `tagFilter` overrides legacy single `tag`.

Canonical invariant table:

| ID | Invariant | Automated lock |
|---|---|---|
| DTF-001 | Non-empty boolean `tagFilter` overrides legacy `tag`. | `src/app/dashboardTagFilterContract.test.ts` |
| DTF-002 | Empty boolean buckets are no-op and legacy `tag` matching applies. | `src/app/dashboardTagFilterContract.test.ts` |
| DTF-003 | `due=next7` uses local-day rolling window `today..+6`. | `src/app/dashboardTagFilterContract.test.ts` |
| DTF-004 | `due=overdue` includes prior-day overdue and same-day explicit-time overdue only after due time passes. | `src/app/dashboardTagFilterContract.test.ts` |

### 2.5 Recurrence Contract
- Recurrence fields: `dtstart`, `rrule`, optional `exdates`, `series_id`.
- Sparse occurrence materialization:
  - Virtual rows render future occurrences.
  - Materialized instance rows represent occurrence overrides/history.

Occurrence actions:
- `Space`: complete/reopen occurrence.
- `x`: skip occurrence.
- `z`: snooze occurrence by +1 day.
- `e`: edit occurrence.
- `E`: edit series definition.
- `d` on occurrence row opens recurring delete modal:
  - `y`: this occurrence only
  - `f`: this and future occurrences
  - `n` / `Esc`: cancel

### 2.6 Task Links / Attachments Contract
- Tasks support `links[]` entries with:
  - `id`
  - `target`
  - optional `label`
  - optional `kind` (`url` or `path`)
- Details pane supports link focus and actions:
  - open (`Enter`/`o`)
  - copy (`c`)
  - add (`l`)
  - edit (`e`)
  - delete (`d`/`Backspace`)
- Add mode supports `Ctrl+L` to attach links in draft before save.
- Unknown URL schemes require explicit user confirmation modal before open.

### 2.7 Dashboard Contract
- `b` / `B` toggles list and dashboard (blocked in text-entry contexts).
- Dashboard uses the same filtered dataset as list.
- Widgets:
  - KPI strip: `OVERDUE`, `TODAY`, `NEXT7`, `OPEN`, `DONE7D`
  - Due-bucket chart
  - `TOP TAGS (OPEN)` with drilldown (`Enter` applies selected tag)
- Dashboard also opens boolean tag panel with `p`.

Canonical invariant table:

| ID | Invariant | Automated lock |
|---|---|---|
| DTF-005 | In `DASHBOARD` mode, `up/down` moves top-tag selection and `Enter` applies selected tag action; list movement keys do not leak. | `src/app/dashboardTagFilterContract.test.ts` |
| DTF-006 | In `TAG_FILTER` mode, list/dashboard routing is blocked until unwind (`Esc`). | `src/app/dashboardTagFilterContract.test.ts` |
| DTF-007 | Dashboard analytics include recurrence occurrences through `buildVisibleTaskRows` parity, not raw tasks-only filtering. | `src/app/dashboardTagFilterContract.test.ts` |

### 2.8 Notifications Contract
- Tier 1: in-app overdue modal queue.
- Tier 2: optional terminal bell with cooldown.
- Tier 3: OS notifier adapter scaffold (current no-op).
- Overdue modal actions:
  - `S`: snooze 10 minutes
  - `D`: mark done
  - `G`: go to task
  - `Esc`: dismiss

### 2.9 Backup and Portability Contract
Backup Center entry:
- `?` then `1` (`DATA: Backup / Export / Import`).

Capabilities:
- timestamped export backups
- import with `merge` or `replace`
- required dry-run before commit
- `replace` requires typed `REPLACE`
- pre-import backup on commit path

### 2.10 Calendar Integration Contract
Export (user-facing CLI):
- `tadoi calendar:export --out <file.ics> [--view <name>] [--range next7|month|all] [--privacy minimal|full]`
- default privacy is `minimal`
- `--include-details` aliases to `--privacy full`
- export includes open tasks only, with recurrence support (`RRULE`, `EXDATE`, instance overrides)

Import:
- User-facing CLI import:
  - `tadoi calendar:import --in <file.ics> [--view <name>] [--range next7|month|all] [--mode merge|update|create] [--dry-run]`
- In-app Backup Center exposes guided calendar import flow:
  - `?` -> `1` (`DATA: Backup / Export / Import`) -> `4) Calendar (ICS)...` -> `2) Import Calendar (.ics)`
- import engine exists in `src/state/calendarImportService.ts` with:
  - `merge|update|create` modes
  - `next7|month|all` range handling
  - dry-run/report support
  - recurrence override/cancellation handling
  - bounded horizon and hard expansion caps

### 2.11 Security and Privacy Contract
- External link policy is settings-driven:
  - `security.nonHttpLinkPolicy: prompt|block`
  - `prompt` requires explicit confirmation for paths and non-allowlisted schemes.
  - `block` blocks those open attempts.
- Links imported from calendar sources default to confirm-on-open behavior.
- Open-target execution rejects control-character payloads and uses argument-based process spawning.
- Startup logs redact absolute paths by default; full paths are opt-in via `TADOI_VERBOSE_PATH_LOGS=1`.

### 2.12 Branding / Left Rail Contract
- Left rail includes `TAG PANEL (P)` menu row.
- Hint strip includes `p: TAG PANEL`.
- Logo modes include:
  - `default`
  - `alternate32`
  - `alternate_slash32`
  - `alternate_blocks32`
  - `rotate`

### 2.13 Engagement Toast Contract
- Bottom-bar engagement toasts are non-interactive and auto-dismiss.
- Toast queue is bounded and priority-ordered; blocking overlays suppress rendering while preserving queue state.
- Current milestone set includes:
  - first task completed
  - first recurring task created
  - first recurring repeat occurrence completed
  - 3 completed today
  - 5 completions for a tag in the last 7 days
  - 3-day completion streak

### 2.14 TIT Command Layer Contract (Milestones 1-3)
- In-app TIT open key: backtick (`` ` ``) in `LIST` mode.
- In-app TIT execute key: `Enter`.
- In-app TIT close key: `Esc`.
- In-app TIT history navigation: `ArrowUp` / `ArrowDown`.
- While TIT is active, list/global keybinds are suppressed and TIT captures input.
- TIT output is single-line and typed:
  - `{ kind: "ok" | "error"; text: string }`
- Command engine is UI-agnostic and lives in `src/commands/*`.

Supported TIT commands:
- `add <title> [due:YYYY-MM-DD] [at:HH:MM] [#tag ...] [notes:"..."]`
- `done` / `done @selected` / `done id:<task-id>`
- `due @selected YYYY-MM-DD [at:HH:MM]`
- `due id:<task-id> YYYY-MM-DD [at:HH:MM]`
- `due @selected clear` / `due id:<task-id> clear`
- `recur <target> clear`
- `recur <target> every:day|week|month [interval:N] [on:mon,wed|1,15]`
- `help` / `help add|done|due|recur`

Validation and mutation rules:
- `due` date must be a real calendar date.
- `at` time must be valid 24-hour local time.
- `at` requires `due`.
- `recur` requires a due date on the target task.
- `done` remains deterministic (`status="done"`) and uses recurrence completion helper for spawn-on-done behavior.

CLI parity and safety:
- CLI wrapper and raw DSL forms are both supported (`src/cli/main.ts`).
- `@selected` is invalid in CLI context; CLI requires `id:<task-id>` for target commands.
- CLI write commands are lock-gated when TUI lock exists.
- TIT CLI exit codes: `0` success, `2` parse/validation, `3` target resolution, `4` lock present, `5` IO error.

## 3) Data Model Contract

Domain core (`src/domain/models.ts`):
- `Task` includes:
  - `tags[]`
  - optional `links[]`
  - optional `recurrence`
  - optional `instance_of`
  - optional `external.calendar` metadata (UID/source/tzid/import tracking fields)
- `Filters` includes:
  - `status`
  - `due`
  - optional `tag`
  - optional `tagFilter` (`all`/`any`/`none`)
  - optional `searchText`
- `SortMode`: `due`, `updated`, `created`, `title`

Persistence expectations:
- local JSON storage
- schema migrations applied at load
- current schema version `5`
- corrupt payload recovery creates `.corrupt.<timestamp>` backup file
- engagement state is persisted and migrated with the rest of app state

## 4) Keybindings Snapshot (Primary)

List mode:
- navigation: `j/k`, arrows, `gg`, `G`, `Ctrl+U`, `Ctrl+D`, `PageUp`, `PageDown`, `[`, `]`, `{`, `}`
- actions: `` ` ``, `a`, `e`, `E`, `c`, `Space`, `x`, `z`, `d`, `/`, `f`, `g`, `s`, `t`, `p`, `v`, `Ctrl+S`, `q`

Details links focus:
- `Tab` / `Shift+Tab` toggles focus between task list and links.
- `Enter`/`o`, `c`, `l`, `e`, `d`/`Backspace`, `Esc`

Global/overlay:
- help: `?` open, `Esc`/`?` close
- search close: `Enter`/`Esc`
- backup center: `1/2/3`, `Enter`, `Esc`
- TIT command bar: open with `` ` `` in list mode, `Esc` close, `Enter` execute, `ArrowUp/ArrowDown` history

## 5) Quality and Validation Baseline

Automated snapshot captured during TIT docs pass (2026-02-20):
- `bun test src/commands/parse.test.ts src/commands/execute.test.ts src/cli/main.test.ts src/app/keyRouter.test.ts src/state/store.test.ts`: `63 pass / 0 fail`
- `bun run typecheck`: `pass`
- Full-suite validation remains tracked in release run reports under `docs/RELEASE_RUN_REPORT.md`.

Manual coverage baseline:
- `docs/TADOI_QA_Guide_v0.3.7.md`

## 6) Non-goals (Current Baseline)
- cloud sync or accounts
- collaboration/multi-user editing
- background daemon delivery while app is closed
- broad NLP natural-language date parsing
- bi-directional or background calendar sync (current behavior is one-way import/export commands)

## 7) Related Documents
- `README.md`
- `docs/TADOI_Installation_Guide_All_Platforms.md`
- `docs/TADOI_QA_Guide_v0.3.7.md`
- `docs/TADOI_Feature_List_v0.3.7.md`
- `docs/specs/tit-m1-commandbar.md`
- `docs/specs/tit-m2-cli.md`
- `docs/specs/tit-m3-recurrence.md`
- `tadoi_TIT_milestone1_spec.md`
- `tit-m2-cli-revised.md`
- `tit-m3-recurrence.md`
- `TADOI_Spec_Calendar_Export_ICS_v0.2.md`
- `TADOI_Spec_Calendar_Import_ICS_RoundTrip_v0.1.md`
- `TADOI_Task_Links_Attachments_Spec_v0.2.md`
- `DASHBOARD_SPEC_MVP.md`
- `TADOI_BackupCenter_InApp_Spec.md`
- `TADOI_Notifications_Spec_Tier1-2_v0.2.md`

## Trademark Notice
TADOI™ is a trademark of <OWNER>. Other names may be trademarks of their respective owners.
