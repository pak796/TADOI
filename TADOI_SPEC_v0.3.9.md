# TADOI™ Product Spec (v0.3.9)

Updated: 2026-03-03
Runtime baseline: `v0.3.9`
Package baseline: `0.3.9`
Persistence schema baseline: `8`

Stability taxonomy:
- `Canonical`: compatibility contract expected to remain stable across patch/minor updates.
- `Current Behavior (May Change)`: documented runtime behavior that may evolve without migration.

## 1) Product Definition

TADOI is a keyboard-first terminal task manager focused on fast personal execution workflows.

Core experience:
- List-first task management with strong keyboard routing and clear mode boundaries.
- TITS command layer (Milestones 1-3): in-app command bar, shared command engine, CLI parity, and recurrence command support.
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
2. TITS command bar handling when active (list mode only)
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
  - KPI strip: `OVERDUE`, `TODAY`, `NEXT{7|14|30}`, `OPEN`, `DONE{7|14|30}D`
  - Due-bucket chart: `OVD`, `TOD`, `+1..+6`
  - `TOP TAGS (OPEN)` with drilldown (`Enter` applies selected tag)
  - compact `PRIORITY STRIP (DRILL-THROUGH)`
  - `DIMENSION SLICES` (`assignee`, `project`, `workflowStage`)
  - backlog trend panel (`7d|14d|30d`)
  - overdue aging + throughput panels
- Dashboard also opens boolean tag panel with `p`.
- Dashboard analytics window cycles with `w`.
- Dashboard focus-group navigation:
  - `Tab` / `Shift+Tab` switches widget group
  - `ArrowUp` / `ArrowDown` moves selection in active group
  - `Enter` applies active selection
- Due-bucket drill-through `+N` applies exact `dueDayOffset=N` with `status=open` and `due=any`.
- Due cycle key (`g`) clears `dueDayOffset`.

Canonical invariant table:

| ID | Invariant | Automated lock |
|---|---|---|
| DTF-005 | In `DASHBOARD` mode, widget selection/drill-through is routed while list movement keys do not leak. | `src/app/dashboardTagFilterContract.test.ts`, `src/app/keyRouter.test.ts`, `src/app/App.modalFlow.integration.test.ts` |
| DTF-006 | In `TAG_FILTER` mode, list/dashboard routing is blocked until unwind (`Esc`). | `src/app/dashboardTagFilterContract.test.ts` |
| DTF-007 | Dashboard analytics include recurrence occurrences through `buildVisibleTaskRows` parity, not raw tasks-only filtering. | `src/app/dashboardTagFilterContract.test.ts` |
| DTF-008 | Saved views round-trip dashboard analytics filters and exact due-day offsets. | `src/domain/savedViews.test.ts` |
| DTF-009 | Dashboard due-bucket `+N` drill-through applies exact `dueDayOffset` filter. | `src/app/App.modalFlow.integration.test.ts`, `src/domain/query.test.ts` |

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
- Left-rail hint strip is mode-aware when `hintDisplayMode` is `left_rail` or `both`.
- Logo modes include:
  - `default`
  - `alternate32`
  - `alternate_slash32`
  - `alternate_blocks32`
  - `rotate`

### 2.13 Theme and Settings Contract
- Theme IDs include:
  - `default`, `retro`, `highContrast`, `neonHacker`, `lightSlate`, `paperWhite`, `midnightBlack`
  - `jester`, `sonora`, `tigers`, `tech`, `deuteranopia`, `protanopia`, `tritanopia`
  - `blueAngels`, `southwest`, `rams`, `trooper`, `twilight`, `msdos`, `niners`, `mcrn`
  - `zeke`, `gundam`, `crtGreen`, `crtAmber`, `kitty`, `corpo`, `strikefitron`, `custom1`, `rotating`
- Theme rotation and rotating-mode order include both CRT themes (`crtGreen`, `crtAmber`).
- Help root is read-only for direct settings hotkeys; settings changes are applied through the Help `Settings & Themes` page flow.
- Settings IA includes sectioned pages:
  - `Appearance`:
    - `Theme`, `Logo`, `Flash Mode`, `CRT FX Lite`, `CRT FX Profile`, `Retro FX Mode`
  - `Navigation & Keymaps`:
    - `Keymap Aliases`, `Navigation Hints`, `Prefix Popup`
  - `Notifications`:
    - `Notifications`, `Overdue Popup`, `Terminal Bell`, `Banner Duration`, `Bell Cooldown`
  - `Security`:
    - `Non-HTTP Link Policy`
  - `TOME Notes`:
    - `TOME Enabled`, `TOME Root Path`, `Restore TOME Guides`
  - `Cloud Backup`:
    - `Cloud Backup Enabled`, `Owner/Repo`, `Branch`, `Auto Push Policy`, `Device ID`, `Path Prefix`, `Open Cloud Operations`
- CRT FX runtime contract:
  - `CRT FX Lite` toggles effect on/off.
  - `CRT FX Profile` cycles color+strength pairs in this order:
    - `Green Subtle`, `Green Regular`, `Green Strong`, `Amber Subtle`, `Amber Regular`, `Amber Strong`
  - Effect applies tint/flicker treatment to primary panel surfaces (left rail, task list panel, details panel).
- Settings persistence normalization:
  - `hintDisplayMode` normalizes to `bottom|left_rail|both|none`; missing/invalid defaults to `bottom`.
  - `showPrefixHintPopup` normalizes to boolean; missing/invalid defaults to `true`.
  - `crtFxLite` persists only when enabled (`true`).
  - `crtFxColor` and `crtFxPreset` persist only when non-default.
  - default profile is `green + normal`.

### 2.14 Engagement Toast Contract
- Bottom-bar engagement toasts are non-interactive and auto-dismiss.
- Toast queue is bounded and priority-ordered; blocking overlays suppress rendering while preserving queue state.
- Current milestone set includes:
  - first task completed
  - first recurring task created
  - first recurring repeat occurrence completed
  - first TOME created (in-app)
  - first checklist created
  - first checklist fully completed
  - 3 completed today
  - 5 completions for a tag in the last 7 days
  - 3-day completion streak

### 2.15 TITS Command Layer Contract (Milestones 1-3)
- In-app TITS open key: backtick (`` ` ``) in `LIST` mode.
- In-app TITS execute key: `Enter`.
- In-app TITS close key: `Esc`.
- In-app TITS history navigation: `ArrowUp` / `ArrowDown`.
- While TITS is active, list/global keybinds are suppressed and TITS captures input.
- TITS output is single-line and typed:
  - `{ kind: "ok" | "error"; text: string }`
- Command engine is UI-agnostic and lives in `src/commands/*`.

Supported TITS commands:
- `add <title> [due:YYYY-MM-DD] [at:HH:MM] [#tag ...] [notes:"..."]`
- `done` / `done @selected` / `done id:<task-id>`
- `due @selected YYYY-MM-DD [at:HH:MM]`
- `due id:<task-id> YYYY-MM-DD [at:HH:MM]`
- `due @selected clear` / `due id:<task-id> clear`
- `recur <target> clear`
- `recur <target> every:day|week|month [interval:N] [on:mon,wed|1,15]`
- `check add @selected <text>`
- `check toggle @selected <index>`
- `check edit @selected <index> <text>`
- `check del @selected <index>`
- `check clear @selected`
- `bulk done|tag|due|priority|assignee|project|stage|delete`
- `note new|open|search|delete|restore-defaults|reindex|root set`
- `help` / `help add|done|due|recur|check|bulk|note`

Validation and mutation rules:
- `due` date must be a real calendar date.
- `at` time must be valid 24-hour local time.
- `at` requires `due`.
- `recur` requires a due date on the target task.
- `done` remains deterministic (`status="done"`) and uses recurrence completion helper for spawn-on-done behavior.

### 2.16 Empty NUX Onboarding Contract
- Empty-state walkthrough flow is step-driven:
  - `welcome -> shortcuts (optional) -> adding -> celebrate -> what_next`
- `celebrate` Enter opens `what_next` (not direct close-to-list).
- `what_next` routes:
  - `t`: first TOME create path
  - `c`: checklist add path for walkthrough-created task
  - `Enter`: return to list and clear walkthrough
  - `a`: add another task
  - `h`: shortcuts
  - `Esc`: clear walkthrough
- `celebrate` and `what_next` show onboarding progress chips as `ONBOARDING X/3`:
  - first task
  - first TOME
  - first checklist fully completed

CLI parity and safety:
- CLI wrapper and raw DSL forms are both supported (`src/cli/main.ts`).
- Interactive routing is explicit:
  - `tadoi` and `tadoi --interactive` launch TUI
  - unknown top-level argv fails fast with usage (`exit 2`) and does not launch TUI
- Wrapper help is non-mutating:
  - `tadoi add --help`
  - `tadoi done --help`
  - `tadoi due --help`
  - `tadoi recur --help`
  - `tadoi help --help`
- `--` delimiter preserves literal dash-prefixed tokens (`tadoi add -- --help` creates title `--help`).
- Non-interactive automation flags:
  - `--json`
  - `--quiet`
  - `--data-file <path>` (per invocation, takes precedence over `TADOI_DATA_PATH`)
- `@selected` is invalid in CLI context; CLI requires `id:<task-id>` for target commands.
- CLI write commands are lock-gated when TUI lock exists.
- TITS CLI exit codes: `0` success, `2` parse/validation, `3` target resolution, `4` lock present, `5` IO error.

## 3) Data Model Contract

Domain core (`src/domain/models.ts`):
- `Task` includes:
  - `tags[]`
  - optional `links[]`
  - optional `recurrence`
  - optional `instance_of`
  - optional `external.calendar` metadata (UID/source/tzid/import tracking fields)
  - optional analytics dimensions: `assignee`, `project`, `workflowStage`
- `Filters` includes:
  - `status`
  - `due`
  - optional `analyticsWindow` (`7d|14d|30d`)
  - optional exact `dueDayOffset` (`1..6`)
  - optional `tag`
  - optional `tagFilter` (`all`/`any`/`none`)
  - optional `searchText`
  - optional `assignee`, `project`, `workflowStage`
- `SortMode`: `due`, `updated`, `created`, `title`

Persistence expectations:
- local JSON storage
- schema migrations applied at load
- current schema version `8`
- migration `6 -> 7` backfills `workflowStage` (`open -> todo`, `done|archived -> done`)
- migration `7 -> 8` normalizes task checklist arrays for strict validation parity
- corrupt payload recovery creates `.corrupt.<timestamp>` backup file
- engagement state is persisted and migrated with the rest of app state

## 4) Keybindings Snapshot (Primary)

List mode:
- navigation: `j/k`, arrows, `Ctrl+g`/`Ctrl+p`/`Ctrl+y` then `g`, `G`, `Ctrl+U`, `Ctrl+D`, `PageUp`, `PageDown`, `[`, `]`, `{`, `}`
- prefix compatibility: `Ctrl+g`/`Ctrl+p`/`Ctrl+y`+`g`/`G` keeps jump semantics; prefix + non-prefix clears and routes only the continuation key.
- actions: `` ` ``, `a`, `e`, `E`, `c`, `Space`, `x`, `z`, `d`, `/`, `f`, `g`, `s`, `t`, `p`, `v`, `Ctrl+S`, `q`

Dashboard mode:
- `f`, `g`, `r`, `t`, `p`, `w`
- `Tab` / `Shift+Tab`, `ArrowUp` / `ArrowDown`, `Enter`
- `b` / `B`, `?`, `q`

Details links focus:
- `Tab` / `Shift+Tab` toggles focus between task list and links.
- `Enter`/`o`, `c`, `l`, `e`, `d`/`Backspace`, `Esc`

Global/overlay:
- help: `?` open, `Esc`/`?` close
- search close: `Enter`/`Esc`
- backup center menu: `1/2/3/4`, `Enter`, `Esc`
- backup center import picker: `j/k`, `ArrowUp`/`ArrowDown`, `PageUp`/`PageDown`, `home/end`, `m`, `Enter`, `Esc`
- backup center content screens: `j/k`, `ArrowUp`/`ArrowDown`, `Ctrl+U`/`Ctrl+D`, `PageUp`/`PageDown`
- TITS command bar: open with `` ` `` in list mode, `Esc` close, `Enter` execute, `ArrowUp/ArrowDown` history

Hinting + alias layer:
- Context hints come from a shared model; display surface is settings-driven:
  - `hintDisplayMode=bottom`: footer `KEYS` bar only
  - `hintDisplayMode=left_rail`: left-rail hints only
  - `hintDisplayMode=both`: both surfaces
  - `hintDisplayMode=none`: no persistent hints
- Pending prefix hint popup for the `Ctrl+g` jump family (fallback `Ctrl+p`/`Ctrl+y`) is controlled independently by `showPrefixHintPopup`.
- Optional settings field `keymapAliases` supports action aliases for contexts `list`, `dashboard`, `backup`, `help`.
- Help Settings exposes a `Keymap Aliases` page to toggle bounded context presets and reset overrides.
- P1 alias token scope: single-key and `Ctrl+<key>` tokens; conflicts are deterministic first-wins with warning output.

## 5) Quality and Validation Baseline

Automated snapshot captured during TITS docs pass (2026-02-20):
- `bun test src/commands/parse.test.ts src/commands/execute.test.ts src/cli/main.test.ts src/app/keyRouter.test.ts src/state/store.test.ts`: `63 pass / 0 fail`
- `bun run typecheck`: `pass`
- Full-suite validation remains tracked in the release run report documents.

Manual coverage baseline:
- `docs/TADOI_QA_Guide_v0.3.9.md`

## 6) Non-goals (Current Baseline)
- cloud sync or accounts
- collaboration/multi-user editing
- background daemon delivery while app is closed
- broad NLP natural-language date parsing
- bi-directional or background calendar sync (current behavior is one-way import/export commands)

## 7) Related Documents
- `README.md`
- Platform installation guide (all platforms)
- `docs/TADOI_QA_Guide_v0.3.9.md`
- `docs/TADOI_Feature_List_v0.3.9.md`
- `docs/specs/tits-m1-commandbar.md`
- `docs/specs/tits-m2-cli.md`
- `docs/specs/tits-m3-recurrence.md`
- `tadoi_TITS_milestone1_spec.md`
- `tits-m2-cli-revised.md`
- `tits-m3-recurrence.md`
- `TADOI_Spec_Calendar_Export_ICS_v0.2.md`
- `TADOI_Spec_Calendar_Import_ICS_RoundTrip_v0.1.md`
- `TADOI_Task_Links_Attachments_Spec_v0.2.md`
- `DASHBOARD_SPEC_MVP.md`
- `TADOI_BackupCenter_InApp_Spec.md`
- `TADOI_Notifications_Spec_Tier1-2_v0.2.md`

## Trademark Notice
TADOI™ is a trademark of <OWNER>. Other names may be trademarks of their respective owners.
