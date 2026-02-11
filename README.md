# TADOI

Terminal Accessible Digital Organization Interface

Keyboard-first TUI todo list with due dates, completion, and tag autocomplete (OpenTUI + React on Bun).

Current version: `v0.3.0` (`package.json`: `0.3.0`).
Feature list: [`docs/TADOI_Feature_List_v0.3.0.md`](./docs/TADOI_Feature_List_v0.3.0.md)

## Setup

```bash
bun install
```

## Run

```bash
bun run dev
```

CLI help:

```bash
bun run start -- --help
```

Version check:

```bash
bun run start -- --version
```

## Supported Environments

Verified baseline terminals:
- macOS Terminal.app
- iTerm2
- Windows Terminal
- GNOME Terminal (Linux baseline)

Minimum supported terminal size:
- `104x24`
- Below this size, TADOI shows a centered `Terminal too small (min 104x24)` screen and pauses normal interactions until resized.

## Data File

TADOI saves tasks to `tadoi_data.json` using this path order:

- `TADOI_DATA_PATH` override (absolute or relative path)
- Linux: `$XDG_DATA_HOME/tadoi/tadoi_data.json`
- Linux fallback: `$HOME/.local/share/tadoi/tadoi_data.json`
- macOS: `$HOME/Library/Application Support/tadoi/tadoi_data.json`
- Windows: `%APPDATA%\\tadoi\\tadoi_data.json`
- Windows fallback: `$HOME\\AppData\\Roaming\\tadoi\\tadoi_data.json`

The active path appears in startup logs and in the Help panel.

Current persisted schema version: `4` (includes recurrence fields).

If a save fails (permissions/disk/IO), TADOI keeps running and shows a persistent banner with the error and data path. It retries on the next domain mutation (not on UI-only ticks).

### Data Backup and Corrupt Recovery

Where your data lives:
- Use the resolved data path shown at startup or in the Help panel.
- By default, it follows the OS-specific locations listed above.

Manual backup examples:

macOS/Linux (replace `<resolved-path>`):
```bash
mkdir -p ~/tadoi-backups
cp "<resolved-path>" "$HOME/tadoi-backups/tadoi_data.$(date +%Y%m%d-%H%M%S).json"
```

Windows PowerShell (replace `<resolved-path>`):
```powershell
New-Item -ItemType Directory -Force "$HOME\\tadoi-backups" | Out-Null
Copy-Item "<resolved-path>" "$HOME\\tadoi-backups\\tadoi_data.$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
```

Corrupt backups created by recovery look like:
- `tadoi_data.json.corrupt.YYYYMMDD-HHMMSS`
- `tadoi_data.json.corrupt.YYYYMMDD-HHMMSS.1` (or higher suffix when needed)

### In-app Backup Center (Recommended)

Open the guided in-app flow from Help:
- `?` to open Help
- `1` to open `DATA: Backup / Export / Import`

Backup Center flow:
- `Export backup`: creates a timestamped backup in the default backups folder.
- `Import data...`: path input -> mode select (`merge` or `replace`) -> dry-run summary -> commit.
- `Show data path`: shows the exact runtime data path.

Safety checks:
- `replace` requires typed confirmation: `REPLACE`.
- Import commit is gated behind dry-run (dry-run always runs first).
- Commit creates a pre-import backup by default.

Reference:
- [`docs/backup-center.md`](./docs/backup-center.md)

## Keybindings

- LIST mode navigation:
  - `j`/`k` or `up`/`down`: move selection
  - `gg`: jump to top
  - `G`: jump to bottom
  - `ctrl+u` / `PageUp`: page up
  - `ctrl+d` / `PageDown`: page down
  - `[` / `]`: previous/next overdue task
  - `{` / `}`: previous/next due-today task
- LIST mode task actions:
  - `b` / `B`: toggle Dashboard mode (ignored in SEARCH/ADD/EDIT and save-view name prompt)
  - `a`: add task
  - `e`: edit selected task (on recurring occurrence rows, edits that single occurrence)
  - `E`: edit recurring series definition
  - `c`: duplicate selected task
  - `space`: toggle selected task done/open (on recurring occurrences, completes/reopens that occurrence)
  - `x`: skip selected recurring occurrence
  - `z`: snooze selected recurring occurrence by `+1 day`
  - `d`: delete selected task (confirm modal `y` / `n` / `Esc`)
  - `/`: open search
  - `f`: cycle status filter
  - `s`: cycle sort mode (`DUE` default keeps open tasks with due dates at the top)
  - `g`: cycle due filter
  - `t`: cycle tag filter across tags on all active (open) tasks
  - `Shift+T`: open boolean tag filter panel (`ALL` / `ANY` / `NONE`)
- Dashboard mode:
  - `b` / `B`: return to list mode
  - `f`: cycle status filter (shared with list)
  - `g`: cycle due filter (shared with list)
  - `t`: cycle tag filter (shared with list)
  - `Shift+T`: open boolean tag filter panel (`ALL` / `ANY` / `NONE`)
  - `up` / `down`: select `TOP TAGS (OPEN)` rows
  - `Enter`: apply selected dashboard tag to active `tag` filter
  - `?`: open help
  - `q`: quit (graceful terminal teardown)
  - Dashboard widgets always use the exact same filtered task set as the task list (including `searchText`).
  - `TOP TAGS (OPEN)` counts open tasks only; when status is `done`/`archived`, it shows an availability hint.
  - Dashboard KPI strip:
    - `OVERDUE`: open tasks overdue (date or explicit-time overdue)
    - `TODAY`: open tasks due today
    - `NEXT7`: open tasks due in rolling next 7 days (today..+6)
    - `OPEN`: open task count in current filtered dataset
    - `DONE7D`: done/closed tasks in last 7 local days from the current filtered dataset
    - KPI bars use Unicode block meters and compact to abbreviated text on narrow widths.
    - KPI colors: `OVERDUE`, `TODAY`, `NEXT7`, `OPEN` use blue; `DONE7D` uses green.
- Saved views:
  - `v`: toggle saved-views overlay
  - `ctrl+s`: open "save current filters as view"
  - `1..9`: apply saved view by slot
  - In overlay: `j`/`k` or arrows move, `Enter` apply, `d` delete, `Esc`/`v` close
- Editor mode:
  - `Tab` / `Shift+Tab`: move between fields
  - `ctrl+s`: save
  - `Esc`: cancel and return to list
  - `ctrl+u` / `PageUp`: scroll editor form up when content overflows
  - `ctrl+d` / `PageDown`: scroll editor form down when content overflows
  - `right arrow`: accept date/tag/time inline suggestions when present
  - Add/Edit pane is split into a scrollable content region and fixed footer (Save/Cancel + hints stay visible).
  - Recurrence controls:
    - Repeat mode: `off|daily|weekly|monthly|custom`
    - Weekly days (`BYDAY`), monthly day (`BYMONTHDAY`)
    - End mode: `never|until|count`
    - Custom `RRULE` text and next-3-occurrence preview
- Search mode:
  - Type to filter task titles/tags
  - `Enter` or `Esc`: return to list
- Help mode:
  - `1`: open Backup Center (`DATA: Backup / Export / Import`)
  - `h` / `H`: cycle theme
  - `m` / `M`: toggle flash mode (`slow` / `static`)
  - `n` / `N`: toggle notifications master switch
  - `o` / `O`: toggle in-app overdue popup modal
  - `l` / `L`: toggle terminal bell on overdue
  - `up` / `down`: move selected Help section
  - `left` / `right`: collapse/expand selected section
  - `Enter` / `Space`: toggle selected section
  - `ctrl+u` / `PageUp`: page Help content up
  - `ctrl+d` / `PageDown`: page Help content down
  - `Esc` or `?`: close help
- Backup Center mode:
  - `1` / `2` / `3`: choose menu option
  - `j` / `k`: move menu selection
  - `Enter`: confirm current step
  - `Esc`: back (or close Backup Center from menu)
- Overdue notification modal (when shown):
  - `s` / `S`: snooze task by 10 minutes
  - `d` / `D`: mark task done
  - `g` / `G`: jump to the task in list mode
  - `Esc`: dismiss current modal
- Quit:
  - `q` in LIST mode (graceful terminal teardown)
  - `Ctrl+C` (handled by OpenTUI renderer)

## Mouse Interactions

- Task list rows: click a task row to select that task.
- Task-row click target: the full row area that receives selection highlight.
- Left-rail MENU rows: click a row to trigger its action (`LIST`, `DASHBOARD`, `ADD`, `EDIT`, `SEARCH`, `HELP`, `DELETE`).
- MENU click target: the full row area that receives menu highlight.
- Editor actions: click `SAVE` or `CANCEL` in the editor pane.
- Bottom rotating info bar: click summary buckets or tag pills to toggle quick filters; click the same item again to clear.

## Tag Autocomplete

Type `#` in the Tags field to get suggestions ranked by usage. Selecting a suggestion fills the current tag token.

## Tag Filtering Modes

- `t`: cycles the legacy single-tag filter across tags on open tasks, then clears.
- `Shift+T`: opens the boolean tag filter panel with `ALL (AND)`, `ANY (OR)`, and `NONE (NOT)` buckets.
- Boolean tag precedence: when `tagFilter` is non-empty, it overrides legacy `tag` matching.

## Recurring Tasks

- Recurrence is stored with RFC5545-style fields on tasks:
  - `recurrence.dtstart` (local floating ISO timestamp)
  - `recurrence.rrule` (RRULE fragment)
  - `recurrence.exdates[]` (excluded occurrences)
  - `recurrence.series_id`
- Recurrence instances are materialized sparsely:
  - Virtual occurrences are rendered from the series for list/dashboard filtering.
  - A real instance row is materialized only when an occurrence is completed, snoozed, skipped, or edited.
- Occurrence semantics:
  - Complete occurrence: adds EXDATE + creates/updates done instance history row.
  - Skip occurrence: adds EXDATE and removes matching materialized instance if present.
  - Snooze occurrence: adds EXDATE and creates/updates an open materialized instance due `+1 day` (local wall-clock preserved when explicit time exists).
  - Edit occurrence: edits/creates one materialized override instance.
  - Edit series (`E`): updates the parent recurring task and RRULE without deleting existing materialized instances.
- Date windows (`Today`, `Next7`, `Overdue`) and dashboard counts include recurrence occurrences through the same visible-row selector used by Task List.

## Settings File

Theme, flash, and notification preferences are persisted in `settings.json`:
- Primary: `~/.config/tadoi/settings.json`
- Fallback: `~/.tadoi/settings.json`

Flash mode values:
- `slow`: due-today and overdue indicators pulse (default)
- `static`: flashing is disabled and overdue indicators stay solid red

Theme IDs:
- `default`, `retro`, `highContrast`, `neonHacker`, `lightSlate`, `paperWhite`, `midnightBlack`
- `jester`, `sonora`, `tigers`, `tech`
- `deuteranopia`, `protanopia`, `tritanopia`
- `blueAngels`, `southwest`, `rams`
- `rotating` (auto-cycles concrete themes)

Notification defaults:
- `notifications.enabled`: `true`
- `notifications.inAppOverdueBanner`: `true` (controls in-app overdue popup modal behavior)
- `notifications.terminalBellOnOverdue`: `false`
- `notifications.bannerDurationMs`: `5000` (retained compatibility field; currently not used by modal UX)
- `notifications.bellCooldownMs`: `2000`

Example:

```json
{
  "themeId": "default",
  "flashMode": "slow",
  "notifications": {
    "enabled": true,
    "inAppOverdueBanner": true,
    "terminalBellOnOverdue": false,
    "bannerDurationMs": 5000,
    "bellCooldownMs": 2000
  }
}
```

## Quality Gates / CI

TADOI uses a GitHub Actions cross-platform matrix on pull requests and pushes to `main`.
CI runs on:
- `ubuntu-latest`
- `macos-latest`
- `windows-latest`

All matrix legs must be green for merges.

Required checks:
- `ci (ubuntu-latest)`: Bun setup, install, test, coverage, typecheck, brand check, and packaging validation
- `ci (macos-latest)`: Bun setup, install, test, coverage, typecheck, and brand check
- `ci (windows-latest)`: Bun setup, install, test, coverage, typecheck, and brand check

Packaging validation (`pack:dry`, `pack:inspect`, `pack:smoke`) runs on the Ubuntu matrix leg.

Local equivalents:

```bash
bun run test
bun run test:coverage
bun run typecheck
bun run brand:check
bun run pack:dry
bun run pack:inspect
bun run pack:smoke
```

## Build & Package

### Plan mode vs build mode

`scripts/build-binary.ts` now supports:
- `--mode plan` (default): write plan artifacts only.
- `--mode build`: create real binaries/installers.

Required flags remain strict:
- `--target macos|windows|linux`
- `--format raw|installer`

Examples:

```bash
# Plan artifacts (default mode)
bun scripts/build-binary.ts --target macos --format raw
bun scripts/build-binary.ts --target windows --format installer

# Real build outputs
bun scripts/build-binary.ts --target macos --format raw --mode build
bun scripts/build-binary.ts --target macos --format installer --mode build
```

### Output locations

- Raw binaries:
  - `dist/bin/macos/tadoi`
  - `dist/bin/windows/tadoi.exe`
  - `dist/bin/linux/tadoi`
- Installer outputs:
  - `dist/installers/TADOI-macOS-<version>.dmg`
  - `dist/installers/TADOI-Setup-x64-<version>.exe`
  - `dist/installers/tadoi_<version>_amd64.deb` (when `dpkg-deb` exists)
  - `dist/installers/tadoi-<version>-x86_64.AppImage` (when `appimagetool` exists)

### Platform tool prerequisites

- macOS:
  - Xcode command line tools (`pkgbuild`, `productbuild`, `hdiutil`)
- Windows:
  - Inno Setup compiler (`iscc`)
- Linux:
  - `dpkg-deb` for `.deb`
  - `appimagetool` for AppImage (optional)

### Signing and notarization (optional)

macOS optional environment variables:
- `TADOI_MAC_SIGN_IDENTITY_INSTALLER`
- `TADOI_MAC_NOTARY_PROFILE`

Windows optional environment variables:
- `TADOI_WIN_SIGN_CERT_PATH`
- `TADOI_WIN_SIGN_CERT_PASSWORD`

If signing env vars are not present, packaging scripts log a skip message and continue local builds.

## Tarball Channel (Non-Live)

Public publish is still intentionally disabled (`"private": true` in `package.json`).
Tarball packaging remains available for internal/private distribution.

```bash
bun run pack:dry
bun run pack:inspect
bun run pack:smoke
```

Install from generated tarball (example):

```bash
bun add -g ./dist/tarball/tadoi-0.3.0.tgz
tadoi --help
```

Release-candidate gate (local):

```bash
bun run release:rc:check
```

## License (Summary)
Licensed under PolyForm Noncommercial 1.0.0.
See [`./LICENSE`](./LICENSE).

- ✅ You may use and modify this software for noncommercial purposes.
- ✅ You may share/redistribute it under the same license terms.
- ❌ You may not use it for commercial purposes (including selling, bundling into paid products, or offering it as part of a paid service).

The `LICENSE` file is the source of truth.

## Optional Perf Debug

Enable lightweight render metrics logging:

```bash
TADOI_PERF_DEBUG=1 bun run dev
```
