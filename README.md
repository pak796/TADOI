# TADOI™

Terminal Accessible Digital Organization Interface

Keyboard-first TUI todo list with due dates, completion, and tag autocomplete (OpenTUI + React on Bun).

Current version: `v0.3.8` (`package.json`: `0.3.8`).
Feature list: [`docs/TADOI_Feature_List_v0.3.8.md`](./docs/TADOI_Feature_List_v0.3.8.md)
Install guide: see the concise installation document in the docs index.
Usage guide: [`docs/USAGE.md`](./docs/USAGE.md)
CLI completions: [`docs/CLI_COMPLETIONS.md`](./docs/CLI_COMPLETIONS.md)
QA guide: [`docs/TADOI_QA_Guide_v0.3.8.md`](./docs/TADOI_QA_Guide_v0.3.8.md)
Smoke checklist: [`docs/QA/SMOKE_TEST_CHECKLIST.md`](./docs/QA/SMOKE_TEST_CHECKLIST.md)
Release checklist: see the release section in the docs index.
Product spec: [`TADOI_SPEC_v0.3.8.md`](./TADOI_SPEC_v0.3.8.md)
Task list: [`TADOI_TASKS_v0.3.8.md`](./TADOI_TASKS_v0.3.8.md)
Documentation index: [`docs/DOC_INDEX.md`](./docs/DOC_INDEX.md)
Archival path policy: [`docs/ARCHIVAL_PATH_POLICY.md`](./docs/ARCHIVAL_PATH_POLICY.md)

## Setup

```bash
bun install
```

`bun install` runs `postinstall` to install user-level CLI completions (`bash`, `zsh`, `fish`).
Set `TADOI_SKIP_COMPLETION_INSTALL=1` to skip completion install in CI/automation.

## Dependency Policy

- Direct runtime dependencies are pinned to explicit versions in `package.json` (no `latest` specifiers).
- Lockfile determinism is required in CI during dependency install.
- Security gate: run `bun audit` on every remediation/release PR; fail on unresolved advisories unless explicitly risk-accepted with owner and expiry.
- Transitive advisory control uses `overrides` where safe; current policy forces `diff@8.0.3`.

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

## TITS Command Layer (v0.3.8)

TITS (Terminal-in-Terminal System) is the shared command language used by both the in-app command bar and the external CLI.

In-app TITS behavior:
- Open from LIST mode with `` ` ``
- Execute with `Enter`
- Close with `Esc`
- Recall command history with `ArrowUp` / `ArrowDown`
- While TITS is active, list/global keybinds are intentionally suppressed

Supported commands:
- `add <title> [due:YYYY-MM-DD] [at:HH:MM] [#tag ...] [notes:"..."]`
- `done` / `done @selected` / `done id:<task-id>`
- `due @selected YYYY-MM-DD [at:HH:MM]` / `due id:<task-id> YYYY-MM-DD [at:HH:MM]` / `due <target> clear`
- `recur <target> clear` / `recur <target> every:day|week|month [interval:N] [on:...]`
- `help` / `help add|done|due|recur`

CLI parity and safety:
- CLI accepts wrapper form (`tadoi add ...`) and raw DSL (`tadoi 'add "Task" #tag'`)
- Interactive routing is explicit and deterministic:
  - `tadoi` or `tadoi --interactive` launches TUI
  - unknown top-level tokens (example: `tadoi --wat`) fail fast and print usage (no TUI fallback)
- Wrapper help is non-mutating:
  - `tadoi add --help`
  - `tadoi done --help`
  - `tadoi due --help`
  - `tadoi recur --help`
  - `tadoi help --help`
- Use `--` delimiter to pass literal dash-prefixed tokens:
  - `tadoi add -- --help` creates a task titled `--help`
- Scriptability flags (non-interactive commands):
  - `--json` emits a machine-readable envelope
  - `--quiet` suppresses non-essential non-error output
  - `--data-file <path>` overrides data path for a single invocation
- CLI rejects `@selected` targets and requires `id:<task-id>`
- CLI write commands are lock-gated while the TUI is running
- Runtime exit code matrix:
  - `0` success
  - `2` usage/parse/validation
  - `3` target-resolution/domain-state mismatch
  - `4` lock/concurrency block
  - `5` IO/filesystem/runtime dependency failure

Canonical TITS spec sources (filename rule `*TITS*.md`):
- `docs/specs/tits-m1-commandbar.md`
- `docs/specs/tits-m2-cli.md`
- `docs/specs/tits-m3-recurrence.md`
- `tadoi_TITS_milestone1_spec.md`
- `tits-m2-cli-revised.md`
- `tits-m3-recurrence.md`

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

- CLI `--data-file <path>` override (highest precedence, per invocation)
- `TADOI_DATA_PATH` override (absolute or relative path)
- Linux: `$XDG_DATA_HOME/tadoi/tadoi_data.json`
- Linux fallback: `$HOME/.local/share/tadoi/tadoi_data.json`
- macOS: `$HOME/Library/Application Support/tadoi/tadoi_data.json`
- Windows: `%APPDATA%\\tadoi\\tadoi_data.json`
- Windows fallback: `$HOME\\AppData\\Roaming\\tadoi\\tadoi_data.json`

The active path appears in startup logs and in the Help panel.

Current persisted schema version: 6 (includes recurrence fields, engagement state, and `stateRevision` optimistic concurrency metadata).

If a save fails (permissions/disk/IO), TADOI keeps running and shows a persistent banner with the error and data path. It retries on the next domain mutation (not on UI-only ticks).
If the banner reports a concurrent save conflict, press `r` or click the banner to reload the latest disk revision and retry save.

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
- `Calendar (ICS)...`: opens calendar export/import guided flows.

Calendar submenu flow:
- `Export Calendar (.ics)`: intro -> range -> view -> privacy -> path -> confirm -> export.
- `Import Calendar (.ics)`: intro -> path -> range -> view -> mode -> horizon -> tag -> mandatory dry-run -> commit.

Safety checks:
- `replace` requires typed confirmation: `REPLACE`.
- Import commit is gated behind dry-run (dry-run always runs first).
- Commit creates a pre-import backup by default.
- Calendar import commit is also gated behind dry-run and creates a pre-import backup.
- High-impact calendar imports (`mode=update` or `range=all`) require typed `IMPORT`.

Reference:
- [`docs/backup-center.md`](./docs/backup-center.md)

### Calendar Integration (ICS)

Export tasks to iCalendar format:

```bash
bun run start -- calendar:export --out ./tadoi.ics
```

Examples:

```bash
bun run start -- calendar:export --out ./tadoi.ics --range next7
bun run start -- calendar:export --out ./tadoi.ics --view Work --range month
bun run start -- calendar:export --out ./tadoi.ics --range all
bun run start -- calendar:export --out ./tadoi.ics --privacy full
```

Import events from iCalendar format:

```bash
bun run start -- calendar:import --in ./tadoi.ics --dry-run
bun run start -- calendar:import --in ./tadoi.ics --mode merge --range month
bun run start -- calendar:import --in ./tadoi.ics --mode update --range all --horizon-days 365
```

Behavior notes:
- In-app Backup Center exposes both `Export Calendar (.ics)` and `Import Calendar (.ics)` guided flows.
- CLI exposes both `calendar:export` and `calendar:import`.
- Exports open tasks only (done/archived excluded).
- Privacy defaults to `minimal` (notes/tags/links/url omitted); use `--privacy full` to include full metadata.
- Compatibility alias: `--include-details` maps to `--privacy full`.
- `next7` uses rolling local days (`today..+6`); `month` uses `today..+29`.
- Recurring series export as `RRULE` + `EXDATE` when valid.
- Instance overrides (`instance_of`) export as standalone events.
- `--range all` requires valid recurring `RRULE` fragments.
- Export now includes round-trip identity headers on VEVENTs: `X-TADOI-TASK-ID`, plus `X-TADOI-SERIES-ID` (series roots) and `X-TADOI-INSTANCE-OF` (instance overrides).
- Import identity precedence is explicit: `X-TADOI-TASK-ID` > TADOI UID conventions (`tadoi-*`) > stored `external.calendar.uid`.
- Import safety baseline: max ICS size `10 MiB` by default, bounded recurrence horizon, hard expansion cap, and mandatory dry-run before commit in Backup Center.
- `calendar:import` uses the shared runtime exit matrix (`0/2/3/4/5`).
- Report write failures are non-fatal warnings when import processing succeeds.

## Stability Notes (As of v0.3.8)

- `Canonical`: filter semantics, routing boundaries, and list/dashboard filtered-data parity.
- `Current Behavior (May Change)`: dashboard presentation/layout details and theme-onboarding UX flow.
- Canonical behavior changes require explicit release-note callouts.

## Engagement Toasts

- Non-interactive bottom-bar engagement toasts reinforce milestone completions.
- Milestones currently include:
  - first task completed
  - first recurring task created
  - first recurring repeat occurrence completed
  - 3 completed today
  - 5 completions for a tag in the last 7 days
  - 3-day completion streak
- Toasts are queued/priority-ordered and suppressed while blocking overlays are active.

## Keybindings

Full canonical list: `docs/USAGE.md` (source: `src/app/keyRouter.ts`).
Canonical router keys (audit-complete):
`/` `1` `2` `3` `4` `?` `ArrowDown` `ArrowLeft` `ArrowRight` `ArrowUp`
`B` `C` `Ctrl+D` `Ctrl+L` `Ctrl+S` `Ctrl+U` `D` `E` `Enter` `Esc`
`G` `L` `O` `PageDown` `PageUp` `S` `Space` `Tab` `[`
`]` `a` `b` `backspace` `c` `d` `e` `end` `f` `g` `h` `home`
`i` `j` `k` `l` `m` `n` `o` `p` `q` `r` `s` `t` `u` `v` `x` `y` `z`
`w`
`{` `}`

- Discoverability + predictability:
  - left-rail `HINTS` are mode-aware (list/dashboard/backup/help)
  - footer `KEYS` bar updates by active context when command/views/save-name overlays are closed
  - pending `g` shows a prefix popup and keeps legacy compatibility:
    - `g` then `g` => jump top
    - `g` then `G` => jump bottom
    - `g` then other key => clear prefix and route only that key (no extra due-cycle mutation)
  - optional action aliases are supported via settings JSON field `keymapAliases` for contexts `list`/`dashboard`/`backup`/`help` (single-key + `Ctrl+<key>` tokens, first-wins conflict policy)

- LIST mode navigation:
  - `j`/`k` or `up`/`down`: move selection
  - `gg`: jump to top
  - `G`: jump to bottom
  - `ctrl+u` / `PageUp`: page up
  - `ctrl+d` / `PageDown`: page down
  - `[` / `]`: previous/next overdue task
  - `{` / `}`: previous/next due-today task
- LIST mode task actions:
  - `Tab` / `Shift+Tab`: toggle focus between task list and details links section
  - `b` / `B`: toggle Dashboard mode (ignored in SEARCH/ADD/EDIT and save-view name prompt)
  - `a`: add task
  - `l`: add link/attachment to selected task
  - `e`: edit selected task (on recurring occurrence rows, edits that single occurrence)
  - `E`: edit recurring series definition
  - `c`: duplicate selected task
  - `space`: toggle selected task done/open (on recurring occurrences, completes/reopens that occurrence)
  - `x`: skip selected recurring occurrence
  - `z`: snooze selected recurring occurrence by `+1 day`
  - `d`: delete selected task (regular modal: `y` / `n` / `Esc`; recurring occurrence modal: `y` this event, `f` this + future, `n` / `Esc` cancel)
  - `/`: open search
  - `f`: cycle status filter
  - `s`: cycle sort mode (`DUE` default keeps open tasks with due dates at the top)
  - `g`: cycle due filter
  - `r`: cycle priority filter across priorities found on open tasks
  - `t`: cycle tag filter across non-priority tags on all active (open) tasks
  - `p`: open boolean tag filter panel (`ALL` / `ANY` / `NONE`)
  - Details links focus (`Tab` from task list):
    - `up`/`down` or `j`/`k`: select previous/next link
    - `Enter` / `o`: open selected link/path
    - `c`: copy selected link target
    - `l`: add link, `e`: edit link, `d`/`Backspace`: remove link
    - `Esc`: return focus to task list
- Dashboard mode:
  - `b` / `B`: return to list mode
  - `f`: cycle status filter (shared with list)
  - `g`: cycle due filter (shared with list)
  - `r`: cycle priority filter (shared with list)
  - `t`: cycle non-priority tag filter (shared with list)
  - `p`: open boolean tag filter panel (`ALL` / `ANY` / `NONE`)
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
  - `ctrl+l` (Add mode): add link/attachment to the new task draft
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
  - `up` / `down`: move selected Help section
  - `left` / `right`: collapse/expand selected section
  - `Enter` / `Space`: toggle selected section
  - `Enter` / `right` on the `Settings` section: open settings pages
  - In settings pages: `up` / `down` move, `Enter` / `right` apply/select, `left` / `Backspace` / `Esc` back
  - Settings include a `Keymap Aliases` page for bounded preset toggles (`list`, `dashboard`, `backup`, `help`)
  - `ctrl+u` / `PageUp`: page Help content up
  - `ctrl+d` / `PageDown`: page Help content down
  - `Esc` or `?`: close help
- Backup Center mode:
  - `1` / `2` / `3` / `4`: choose root menu option
  - In Calendar submenu and select steps, number keys choose options shown on-screen
  - `j` / `k`: move menu/picker selection
  - Content screens (dry-run/done/error): `j` / `k` or `ArrowUp` / `ArrowDown` scroll by line
  - Content screens: `ctrl+u` / `ctrl+d` / `PageUp` / `PageDown` scroll by page
  - `Enter`: confirm current step
  - `Esc`: back (or close Backup Center from menu)
- Overdue notification modal (when shown):
  - `s` / `S`: snooze task by 10 minutes
  - `d` / `D`: mark task done
  - `g` / `G`: jump to the task in list mode
  - `Esc`: dismiss current modal
- Quit:
  - `q` in LIST or DASHBOARD mode (graceful terminal teardown)

## Mouse Interactions

- Task list rows: click a task row to select that task.
- Task-row click target: the full row area that receives selection highlight.
- Left-rail MENU rows: click a row to trigger its action (`LIST`, `DASHBOARD`, `ADD`, `EDIT`, `SEARCH`, `HELP`, `DELETE`).
- MENU click target: the full row area that receives menu highlight.
- Dashboard top-tags chart: click a top-tag row to apply that tag filter.
- Editor actions: click `SAVE` or `CANCEL` in the editor pane.
- Details links: click once to select a link, click the selected row again to open it.
- Bottom rotating info bar: click summary buckets or tag pills to toggle quick filters; click the same item again to clear.

## Tag Autocomplete

Type `#` in the Tags field to get suggestions ranked by usage. Selecting a suggestion fills the current tag token.

## Tag Filtering Modes

- `r`: cycles priority filter by priority tokens present on open tasks.
- `t`: cycles the legacy single-tag filter across non-priority tags on open tasks, then clears.
- `p`: opens the boolean tag filter panel with `ALL (AND)`, `ANY (OR)`, and `NONE (NOT)` buckets; priority tokens are ignored.
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
  - Delete occurrence modal (`d` on an occurrence row):
    - `y`: delete this event only (adds EXDATE, removes matching instance override).
    - `f`: delete this event and all future events in the series.
    - `n` / `Esc`: cancel.
  - Edit occurrence: edits/creates one materialized override instance.
  - Edit series (`E`): updates the parent recurring task and RRULE without deleting existing materialized instances.
- Date windows (`Today`, `Next7`, `Overdue`) and dashboard counts include recurrence occurrences through the same visible-row selector used by Task List.

## Settings File

Theme, logo, flash, CRT FX, notification, and security preferences are persisted in `settings.json`:
- Primary: `~/.config/tadoi/settings.json`
- Fallback: `~/.tadoi/settings.json`

Help Settings pages expose:
- `Theme`
- `Logo`
- `Flash Mode`
- `CRT FX Lite`
- `CRT FX Profile`
- `Notifications`
- `Overdue Popup`
- `Terminal Bell`

Flash mode values:
- `slow`: due-today and overdue indicators pulse (default)
- `static`: flashing is disabled and overdue indicators stay solid red

Theme IDs:
- `default`, `retro`, `highContrast`, `neonHacker`, `lightSlate`, `paperWhite`, `midnightBlack`
- `jester`, `sonora`, `tigers`, `tech`, `deuteranopia`, `protanopia`, `tritanopia`
- `blueAngels`, `southwest`, `rams`, `trooper`, `twilight`, `msdos`, `niners`, `mcrn`
- `zeke`, `gundam`, `crtGreen`, `crtAmber`, `custom1`, `rotating` (auto-cycles concrete themes)

Notification defaults:
- `notifications.enabled`: `true`
- `notifications.inAppOverdueBanner`: `true` (controls in-app overdue popup modal behavior)
- `notifications.terminalBellOnOverdue`: `false`
- `notifications.bannerDurationMs`: `5000` (retained compatibility field; currently not used by modal UX)
- `notifications.bellCooldownMs`: `2000`

CRT FX defaults and persistence:
- `crtFxLite`: `false` by default; only persisted when enabled (`true`)
- `crtFxColor`: `green|amber`; default `green` (default omitted from file)
- `crtFxPreset`: `subtle|normal|strong`; default `normal` (default omitted from file)
- `CRT FX Profile` cycles six combinations in order:
  - `Green Subtle`
  - `Green Regular`
  - `Green Strong`
  - `Amber Subtle`
  - `Amber Regular`
  - `Amber Strong`

Security defaults:
- `security.nonHttpLinkPolicy`: `prompt`
  - `prompt`: require confirmation for filesystem paths and non-allowlisted schemes.
  - `block`: block those open attempts and show a security banner.

Privacy defaults:
- Startup path logs are redacted (`~/...`) by default.
- Set `TADOI_VERBOSE_PATH_LOGS=1` only when full absolute startup paths are needed for debugging.

Example:

```json
{
  "themeId": "default",
  "flashMode": "slow",
  "crtFxLite": true,
  "crtFxColor": "amber",
  "crtFxPreset": "strong",
  "notifications": {
    "enabled": true,
    "inAppOverdueBanner": true,
    "terminalBellOnOverdue": false,
    "bannerDurationMs": 5000,
    "bellCooldownMs": 2000
  },
  "security": {
    "nonHttpLinkPolicy": "prompt"
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
- `ci (ubuntu-latest)`: Bun setup, install, test, coverage, typecheck, brand check, tarball packaging validation, installer build, installer manifest gate, and installer smoke checks
- `ci (macos-latest)`: Bun setup, install, test, coverage, typecheck, brand check, installer build, installer manifest gate, and installer smoke checks
- `ci (windows-latest)`: Bun setup, install, test, typecheck, brand check, installer build, installer manifest gate, and installer smoke checks

Packaging validation (`pack:dry`, `pack:inspect`, `pack:smoke`) runs on the Ubuntu matrix leg.

Daily build workflow: `.github/workflows/daily-build.yml` (scheduled 14:00 UTC).

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

# Convenience script for macOS test installer output
bun run build:installer:mac:all
```

### Daily build (all platforms via CI)

```bash
bun run build:daily
```

Daily build outputs land in:
- `dist/artifacts/YYYY-MM-DD/BUILD_REPORT.md`
- `dist/artifacts/YYYY-MM-DD/<platform>/...`

### Output locations

- Raw binaries:
  - `dist/bin/macos/tadoi`
  - `dist/bin/windows/tadoi.exe`
  - `dist/bin/linux/tadoi`
- Installer outputs:
  - `dist/installers/TADOI-<version>.pkg`
  - `dist/installers/TADOI-macOS-<version>.dmg`
  - `dist/installers/TADOI-Setup-x64-<version>.exe`
  - `dist/installers/tadoi_<version>_amd64.deb`
  - `dist/installers/tadoi-<version>-x86_64.AppImage`
  - `dist/installers/TADOI-<target>-<version>-manifest.json` (`target` in `macos|windows|linux`)

### Platform tool prerequisites

- macOS:
  - Xcode command line tools (`pkgbuild`, `productbuild`, `hdiutil`)
- Windows:
  - Inno Setup compiler (`iscc`)
- Linux:
  - `dpkg-deb` for `.deb`
  - `appimagetool` for AppImage (required in installer build mode)

### Signing and notarization (optional)

macOS optional environment variables:
- `TADOI_MAC_SIGN_IDENTITY_INSTALLER`
- `TADOI_MAC_NOTARY_PROFILE`

Windows optional environment variables:
- `TADOI_WIN_SIGN_CERT_PATH`
- `TADOI_WIN_SIGN_CERT_PASSWORD`

If signing env vars are not present, packaging scripts log a skip message and continue local builds.

Installer manifest gate command:

```bash
bun run installer:gate --target macos
```

### Downloadable macOS artifacts from GitHub

Use `.github/workflows/package-macos.yml` to build and download macOS install artifacts:

1. Push your branch to GitHub.
2. Run **Package macOS Installer** from Actions (or push to `main` to run automatically).
3. Download artifact `tadoi-macos-<commit-sha>` from the workflow run.
4. Install on another Mac using `TADOI-macOS-<version>.dmg` (contains `TADOI-<version>.pkg`).

Tagged releases still publish cross-platform assets through the GitHub Actions release workflow.

### Beta installer troubleshooting (quick)

- Windows: installer adds `Program Files\\TADOI` to user `PATH`; open a new terminal session before running `tadoi --version`.
- Linux: installer build is strict; missing `dpkg-deb` or `appimagetool` now fails with install hints.
- macOS: DMG should contain both `TADOI-<version>.pkg` and `README.txt`; naming/version mismatches fail installer smoke.

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
bun add -g ./dist/tarball/tadoi-0.3.8.tgz
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

## Trademark Notice
TADOI™ is a trademark of <OWNER>. Other names may be trademarks of their respective owners.
