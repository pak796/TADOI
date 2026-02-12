# TADOI™ Product Spec (v0.3.4)

Updated: 2026-02-12
Runtime baseline: `v0.3.4`
Package baseline: `0.3.4`
Persistence schema baseline: `4`

## 1) Product Definition

TADOI is a keyboard-first terminal task manager focused on fast personal execution workflows.

Core experience:
- List-first task management with strong keyboard routing and clear mode boundaries.
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
2. help/back subpage handling
3. search/editor text contexts
4. list/dashboard actions

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

### 2.10 Branding / Left Rail Contract
- Left rail includes `TAG PANEL (P)` menu row.
- Hint strip includes `p: TAG PANEL`.
- Logo modes include:
  - `default`
  - `alternate32`
  - `alternate_slash32`
  - `alternate_blocks32`
  - `rotate`

## 3) Data Model Contract

Domain core (`src/domain/models.ts`):
- `Task` includes `tags[]`, optional `links[]`, optional `recurrence`, optional `instance_of`.
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
- current schema version `4`
- corrupt payload recovery creates `.corrupt.<timestamp>` backup file

## 4) Keybindings Snapshot (Primary)

List mode:
- navigation: `j/k`, arrows, `gg`, `G`, `Ctrl+U`, `Ctrl+D`, `PageUp`, `PageDown`, `[`, `]`, `{`, `}`
- actions: `a`, `e`, `E`, `c`, `Space`, `x`, `z`, `d`, `/`, `f`, `g`, `s`, `t`, `p`, `v`, `Ctrl+S`, `q`

Details links focus:
- `Tab` / `Shift+Tab` toggles focus between task list and links.
- `Enter`/`o`, `c`, `l`, `e`, `d`/`Backspace`, `Esc`

Global/overlay:
- help: `?` open, `Esc`/`?` close
- search close: `Enter`/`Esc`
- backup center: `1/2/3`, `Enter`, `Esc`

## 5) Quality and Validation Baseline

Automated snapshot captured during docs audit:
- `bun run test`: `355 pass / 0 fail / 355 total`
- `bun run typecheck`: `pass`

Manual coverage baseline:
- `docs/TADOI_QA_Guide_v0.3.4.md`

## 6) Non-goals (Current Baseline)
- cloud sync or accounts
- collaboration/multi-user editing
- background daemon delivery while app is closed
- broad NLP natural-language date parsing

## 7) Related Documents
- `README.md`
- `docs/TADOI_Installation_Guide_All_Platforms.md`
- `docs/TADOI_QA_Guide_v0.3.4.md`
- `docs/TADOI_Feature_List_v0.3.4.md`
- `DASHBOARD_SPEC_MVP.md`
- `TADOI_BackupCenter_InApp_Spec.md`
- `TADOI_Notifications_Spec_Tier1-2_v0.2.md`

## Trademark Notice
TADOI™ is a trademark of <OWNER>. Other names may be trademarks of their respective owners.
