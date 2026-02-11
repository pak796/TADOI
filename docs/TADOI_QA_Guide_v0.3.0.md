# TADOI™ QA Guide (v0.3.0)

## 1) Purpose

This guide defines how to validate TADOI across three supported platforms:

- macOS
- Windows
- Linux

References:

- Product/runtime specs: `TADOI_SPEC_v0.3.0.md`, `DASHBOARD_SPEC_MVP.md`, `TADOI_BackupCenter_InApp_Spec.md`
- Implementation: `src/app`, `src/components`, `src/domain`, `src/state`, `src/settings`
- CI contract: `.github/workflows/ci.yml`

## 2) Codebase Analysis Summary

### Architecture

- UI shell and mode orchestration: `src/app/App.tsx`
- Keyboard routing contracts and mode guards: `src/app/keyRouter.ts`
- Core domain logic:
  - filtering/sorting: `src/domain/query.ts`
  - recurrence-aware visible rows: `src/domain/taskRows.ts`
  - recurrence engine: `src/domain/recurrence/engine.ts`
  - dashboard aggregates: `src/domain/dashboard.ts`, `src/domain/dashboardKpis.ts`
- Persistence and data safety:
  - load/save/migration/corrupt recovery: `src/state/persistence.ts`
  - import/export/backup center service: `src/state/backupService.ts`

### Current quality signal

- Automated tests: verify current pass status with local `bun run test`
- Test files: `src/**/*.test.ts` (includes recurrence, dashboard, backup, and notifications modal coverage)
- CI runs on all 3 OS targets (Ubuntu, macOS, Windows) with required checks:
  - tests
  - coverage
  - typecheck
  - branding guard
  - packaging checks on Ubuntu

### High-risk areas to prioritize

- Recurrence behavior (virtual rows vs materialized instances, DST/time semantics)
- Backup/import safety flow (replace confirmation, dry-run gating, pre-import backup)
- Data corruption recovery and path resolution by platform
- Key routing boundaries (no leakage between LIST/EDIT/SEARCH/HELP/DASHBOARD/BACKUP modes)
- Notification modal behavior (queue ordering, modal key routing, action semantics, bell cooldown)
- Layout resilience at minimum terminal size (`104x24`)

## 3) Platform Matrix

| Area | macOS | Windows | Linux |
|---|---|---|---|
| Terminal baseline | Terminal.app / iTerm2 | Windows Terminal | GNOME Terminal |
| Data path default | `~/Library/Application Support/tadoi/tadoi_data.json` | `%APPDATA%\\tadoi\\tadoi_data.json` (fallback `%USERPROFILE%\\AppData\\Roaming\\tadoi\\tadoi_data.json`) | `$XDG_DATA_HOME/tadoi/tadoi_data.json` (fallback `~/.local/share/tadoi/tadoi_data.json`) |
| Settings path | `~/.config/tadoi/settings.json` (fallback `~/.tadoi/settings.json`) | same runtime behavior (Node path handling) | same runtime behavior |
| CI coverage | yes | yes | yes |

## 4) Test Environment Setup

### Prerequisites

1. Install Bun `>=1.3.9`
2. From project root:
   - `bun install`
   - `bun run test`
   - `bun run typecheck`

### Start app

- `bun run dev`

### Recommended clean-state runs

1. Override storage to sandboxed file:
   - macOS/Linux: `TADOI_DATA_PATH=/tmp/tadoi_data.qa.json bun run dev`
   - Windows PowerShell: `$env:TADOI_DATA_PATH="$env:TEMP\\tadoi_data.qa.json"; bun run dev`
2. Remove override file between suites to avoid cross-test contamination.

## 5) Functional QA Suites

Run these suites on all three platforms.

### A. Launch, Layout, and Resize

1. Launch app in terminal at or above `104x24`.
Expected: three-pane shell renders, no crash.
2. Resize below `104x24`.
Expected: blocking warning screen: `Terminal too small (min 104x24)`.
3. Resize back above minimum.
Expected: normal interaction restored without restart.

### B. Core Task Lifecycle

1. Add task (`a`) with title only, save (`Ctrl+S`).
2. Edit task (`e`), update title/notes/tags/due, save.
3. Toggle complete/open (`Space`).
4. Duplicate (`c`) and confirm draft behavior.
5. Delete (`d` then `y`); verify cancel path (`n`/`Esc`).
Expected: selection remains valid; no mode leakage.

### C. Filters, Sort, Search, Saved Views

1. Cycle status (`f`), due (`g`), sort (`s`), and legacy tag cycle (`t`).
2. Open boolean tag filter panel (`Shift+T`), add at least one tag in `ALL`, and apply.
3. Validate precedence: with non-empty boolean `tagFilter`, matching should follow `ALL/ANY/NONE` rules instead of legacy `tag`.
4. Search (`/`) by title/tag fragments; exit with `Enter` and `Esc`.
5. Saved views:
   - open overlay (`v`)
   - save prompt (`Ctrl+S`)
   - apply slots (`1..9`)
   - delete in overlay (`d`)
Expected: filters apply consistently and selection stability is preserved by task id when possible.

### D. Keyboard Navigation and Routing Contracts

1. List movement: `j/k`, arrows, `gg`, `G`, `Ctrl+U`, `Ctrl+D`, `[` `]` `{` `}`.
2. Ensure list keys do not affect text-entry contexts (SEARCH/ADD/EDIT/save-view prompt).
3. Dashboard toggle (`b`/`B`) works only in allowed contexts.
Expected: no cross-mode key leakage.

### E. Dashboard Mode

1. Toggle dashboard (`b`).
2. Validate KPI strip: `OVERDUE`, `TODAY`, `NEXT7`, `OPEN`, `DONE7D`.
3. Validate compact fallback at narrow widths.
4. Top tags panel:
   - select row with `up/down`
   - apply tag filter with `Enter`
5. Confirm dashboard and list share exact filtered dataset.

### F. Recurring Tasks

1. Create series in editor (`daily`, `weekly`, `monthly`, `custom RRULE`).
2. Validate next-3 preview.
3. On occurrence rows:
   - complete (`Space`)
   - skip (`x`)
   - snooze +1 day (`z`)
   - edit occurrence (`e`) vs series (`E`)
4. Validate recurrence appears correctly in list and dashboard counts.
Expected: occurrence actions do not close parent series; materialized rows suppress matching virtual rows.

### G. Backup Center / Portability

1. Open help (`?`) -> `1` to Backup Center.
2. Export backup.
Expected: timestamped file created, collision suffix handling (`.1`, `.2`).
3. Import merge mode:
   - path input
   - dry-run summary shown
   - commit succeeds
4. Import replace mode:
   - typed confirmation `REPLACE` required
   - dry-run required before commit
   - pre-import backup created by default
5. Show data path option.
Expected: displays current resolved runtime path.

### H. Theme, Flash, and Notification Settings

1. Open help (`?`), cycle theme (`h/H`).
2. Toggle flash mode (`m/M`).
3. Toggle notification settings in Help:
   - master (`n/N`)
   - overdue popup (`o/O`)
   - terminal bell (`l/L`)
4. Restart app.
Expected: settings persist and load.

### I. Overdue Notification Modal Actions

1. Enable notifications and overdue popup in Help.
2. Create a timed task due within 1 minute.
3. Wait for overdue transition while app remains open.
4. Validate modal actions:
   - `S`: snooze by +10 minutes
   - `D`: mark done
   - `G`: go to task
   - `Esc`: dismiss current modal
5. If terminal bell is enabled, verify bell respects cooldown.
Expected: modal actions are deterministic and recurring rows resolve correctly.

### J. Mouse Interactions

1. Click task row to select.
2. Click left-rail menu row to trigger action.
3. Click editor `SAVE`/`CANCEL`.
4. Click bottom info bar quick-filter buckets/tags.
5. Trigger overdue popup and click action buttons.
Expected: mouse actions map to documented commands and preserve mode safety.

### K. Data Safety and Recovery

1. Validate save error banner by forcing unwritable data path.
2. Create malformed JSON in data file and relaunch.
Expected: app recovers to empty state, creates `.corrupt.<timestamp>` backup, shows banner.
3. Validate startup archive aging of done tasks older than 7 days.

## 6) Platform-Specific Checks

### macOS

1. Validate runtime path resolution under `~/Library/Application Support/tadoi/`.
2. Validate in Terminal.app and iTerm2.
3. Optional binary scaffold check: `bun run build:bin:mac` (planning artifact).

### Windows

1. Validate `%APPDATA%\\tadoi\\tadoi_data.json` resolution and fallback behavior.
2. Validate path entry/escaping in Backup Center import path input.
3. Verify key handling in Windows Terminal for:
   - `Ctrl+U`, `Ctrl+D`
   - `PageUp`, `PageDown`
4. Optional binary scaffold check: `bun run build:bin:win` (planning artifact).

### Linux

1. Validate `$XDG_DATA_HOME` path resolution and fallback to `~/.local/share/tadoi/`.
2. Validate GNOME Terminal rendering and minimum-size handling.
3. Validate clipboard/path paste behavior in import flow with absolute and relative paths.

## 7) Suggested Regression Execution Order

1. Quick smoke (all three OS): Launch, add/edit/toggle/delete, quit.
2. Core regression: suites A-D + H.
3. Deep regression: suites E-G + I + K.
4. Final packaging/CI parity:
   - `bun run test`
   - `bun run test:coverage`
   - `bun run typecheck`
   - `bun run brand:check`
   - `bun run pack:dry`
   - `bun run pack:inspect`
   - `bun run pack:smoke`

## 8) QA Evidence Template (Per Platform)

Use this structure in test reports:

- Platform + terminal + version
- Build/source revision
- Test suites executed (A-K)
- Pass/fail count
- Defects:
  - id
  - severity
  - repro steps
  - expected vs actual
  - screenshot/log
- Notes on data path used (`TADOI_DATA_PATH` or default)

## 9) Exit Criteria

Release candidate is QA-ready when:

1. No P0/P1 defects remain open.
2. Suites A-D and G pass on all three platforms.
3. Recurrence suite (F) passes on at least one DST-observing timezone run.
4. CI matrix is fully green on Ubuntu/macOS/Windows.
5. Backup Center import/replace safety gates verified on all three platforms.
