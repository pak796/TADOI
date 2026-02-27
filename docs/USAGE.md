# TADOI™ Usage Guide

Verified as of 2026-02-27 (v0.3.9).
Source of truth for key routing: `src/app/keyRouter.ts`.

## Run

```bash
bun run dev
```

Help and version:

```bash
bun run start -- --help
bun run start -- --version
```

External CLI runtime contract:
- `tadoi` launches interactive TUI.
- `tadoi --interactive` forces interactive TUI launch.
- Unknown top-level tokens fail fast with usage (`exit 2`), no interactive fallback.
- Global automation flags (non-interactive commands):
  - `--json`
  - `--quiet`
  - `--data-file <path>` (takes precedence over `TADOI_DATA_PATH` for that invocation)
- `--` delimiter keeps literal dash-prefixed command tokens:
  - `tadoi add -- --help` creates title `--help`.

## Core Modes
- LIST
- ADD
- EDIT
- SEARCH
- HELP
- BACKUP_CENTER
- TAG_FILTER (boolean tag panel)
- DASHBOARD
- MODAL_CONFIRM

Esc/Enter contracts and modal semantics are enforced across all modes.

## Keybindings (Canonical)

Source-of-truth key tokens (as reported by `src/app/keyRouter.ts`):
`/` `1` `2` `3` `4` `?` `ArrowDown` `ArrowLeft` `ArrowRight` `ArrowUp`
`A` `B` `C` `Ctrl+D` `Ctrl+G` `Ctrl+L` `Ctrl+P` `Ctrl+S` `Ctrl+U` `Ctrl+Y` `D` `E` `Enter` `Esc`
`G` `L` `O` `PageDown` `PageUp` `S` `Space` `Tab` `[`
`]` `a` `b` `backspace` `c` `d` `e` `end` `f` `g` `h` `home`
`i` `j` `k` `l` `m` `n` `o` `p` `q` `r` `s` `t` `u` `v` `x` `y` `z`
`w`
`{` `}`

Discoverability and prefix behavior:
- Context hints are shared from a single model:
  - `Navigation Hints` setting controls surfaces: `bottom only` (default), `left rail only`, `both`, `none`
  - left rail `HINTS` block is mode-aware (list/dashboard/backup/help) when enabled
  - footer `KEYS` hint bar updates by active mode when enabled and no command/views/save-name overlay is active
- Pending `Ctrl+g` prefix (fallback `Ctrl+p` / `Ctrl+y`) shows a transient popup:
  - popup visibility is controlled by `Prefix Popup` setting (default: `on`)
  - `Ctrl+g` or `Ctrl+p` or `Ctrl+y`, then `g` jumps to top
  - `Ctrl+g` or `Ctrl+p` or `Ctrl+y`, then `G` jumps to bottom
  - `Ctrl+g` or `Ctrl+p` or `Ctrl+y`, then any non-prefix key clears prefix and routes only that key
- Optional action aliases can be set via settings JSON field `keymapAliases`:
  - supported contexts: `list`, `dashboard`, `backup`, `help`
  - P1 token scope: single-key tokens and `Ctrl+<key>`
  - deterministic conflict rule: first action owning a token wins, later conflicting assignments are ignored with a warning


LIST mode navigation:
- `j` / `k` / `ArrowUp` / `ArrowDown`: move selection
- `Ctrl+g` or `Ctrl+p` or `Ctrl+y`, then `g`: jump to top
- `G`: jump to bottom
- `Ctrl+U` / `page_up` / `pageup` / `prior`: page up
- `Ctrl+D` / `page_down` / `pagedown` / `next`: page down
- `[` / `]`: previous/next overdue task
- `{` / `}`: previous/next due-today task

LIST mode actions:
- `a`: add task
- `e`: edit selected task
- `E`: edit recurring series
- `c` / `C`: duplicate selected task
- `m`: mark/unmark selected row for bulk commands
  - Virtual recurring occurrence rows are rejected with: `Bulk selection does not support virtual occurrences (yet).`
- `l`: add link/attachment
- `Space`: toggle done/open
- `x`: skip recurring occurrence
- `z`: snooze recurring occurrence `+1 day`
- `d`: delete task (modal)
- `/`: open Search
- `f`: cycle status filter
- `s`: cycle sort mode
- `g`: cycle due filter
- `r`: cycle priority filter
- `t`: cycle non-priority tag filter
- `p`: open boolean tag filter panel
- `b` / `B`: toggle Dashboard
- `Esc`: clear active bulk marks (when any marks exist); otherwise normal unwind behavior

Details pane focus (Tab from list):
- `Tab` / `Shift+Tab`: toggle focus list <-> details (default subpane: links)
- While focused in details: `ArrowLeft` / `ArrowRight` switches `LINKS` <-> `CHECKLIST`
- `ArrowUp` / `ArrowDown` / `j` / `k`: move selection
- `Enter` / `o`: open selected link/path
- `c`: copy selected link
- `l`: add link, `e`: edit link, `d` / `backspace`: remove link
- `Esc`: return focus to list

Details checklist subpane:
- `ArrowUp` / `ArrowDown` / `j` / `k`: move checklist selection
- `Space`: toggle selected checklist item
- `a` / `A`: add checklist item
- `e` / `E`: edit selected checklist item
- `d` / `D` / `backspace`: delete selected checklist item (confirm modal)
- `Enter`: no-op (does not toggle or unwind)
- `Esc`: return focus to list

DASHBOARD mode:
- `b` / `B`: return to list
- `f` / `g` / `r` / `t` / `p`: same filter cycling as list
- `w`: cycle analytics window (`7d -> 14d -> 30d -> 7d`)
- `Tab` / `Shift+Tab`: move active dashboard focus group
- `ArrowUp` / `ArrowDown`: move selection inside the active dashboard widget
- `Enter`: apply active dashboard selection (top tags, due buckets, priority strip, assignee/project/stage slices)
- `g` cycle clears exact due-day offset (`DUE+N`) when present
- `?`: open Help
- `q`: quit

Saved views overlay:
- `v`: open/close overlay
- `Ctrl+S`: save current filters as view
- `1..9`: apply view by slot
- In overlay: `j` / `k` / `ArrowUp` / `ArrowDown` move, `Enter` apply, `d` delete, `Esc` / `v` close

ADD/EDIT mode:
- `Tab` / `Shift+Tab`: move fields
- `Ctrl+S`: save
- `Ctrl+L`: add link/attachment in Add mode
- `Esc`: cancel
- `Ctrl+U` / `Ctrl+D` / `page_up` / `page_down`: scroll editor form
- `ArrowRight`: accept inline suggestions when present
- Checklist editor field: `j` / `k` / arrows move item, `Space` toggle, `a` add, `e` edit, `d`/`backspace` delete

SEARCH mode:
- Type to filter
- `Enter` or `Esc`: return to list

HELP mode:
- `1`: open Backup Center
- `ArrowUp` / `ArrowDown`: move section
- `ArrowLeft` / `ArrowRight`: collapse/expand section
- `Enter` / `Space`: toggle section
- `Enter` / `ArrowRight` on Settings: open settings pages
- Help root is read-only for direct settings hotkeys (`h` / `m` / `n` / `o` / `l` do not toggle settings in HELP mode)
- Settings page entries:
  - `Theme`, `Navigation Hints`, `Prefix Popup`, `Logo`, `Flash Mode`, `CRT FX Lite`, `CRT FX Profile`, `Notifications`, `Overdue Popup`, `Terminal Bell`
  - `Keymap Aliases` page toggles bounded presets for `list`, `dashboard`, `backup`, and `help` alias contexts
- In settings pages: `ArrowUp` / `ArrowDown` move, `Enter` / `ArrowRight` apply/select, `ArrowLeft` / `backspace` / `Esc` back
- `Ctrl+U` / `Ctrl+D` / `page_up` / `page_down`: page help content
- `Esc` or `?`: close Help

BACKUP_CENTER mode:
- `1` / `2` / `3` / `4`: choose root menu option
- Number keys choose on-screen options
- `j` / `k`: move menu/picker selection
- Import picker: `ArrowUp` / `ArrowDown` (or `j` / `k`) move, `PageUp` / `PageDown` page, `home` / `end` jump, `m` manual path
- Content screens (dry-run/done/error): `j` / `k` or `ArrowUp` / `ArrowDown` scroll by line
- Content screens: `Ctrl+U` / `Ctrl+D` / `page_up` / `page_down` scroll by page
- `Enter`: confirm
- `Esc`: back/close

Overdue modal:
- `s` / `S`: snooze 10 minutes
- `d` / `D`: mark done
- `g` / `G`: jump to task
- `Esc`: dismiss

Empty-state NUX modal:
- `a` / `Enter`: create first task flow
- `h`: open shortcuts step
- `s` / `Esc`: dismiss
- `i`: open recovery import flow (only when recovery import CTA is available)

## TITS Command Layer (M1-M3)

Source-of-truth files:
- `src/app/App.tsx` (in-app TITS overlay)
- `src/commands/*` (shared parser/executor)
- `src/cli/main.ts` (external TITS CLI)

In-app TITS (LIST mode only):
- Open with `` ` ``
- `Enter` executes current command
- `Esc` closes TITS without executing
- `ArrowUp` / `ArrowDown` navigates command history
- While TITS is open, normal list/global routing is suppressed

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
- `bulk done`
- `bulk tag add #tag...`
- `bulk tag rm #tag...`
- `bulk due YYYY-MM-DD [at:HH:MM]`
- `bulk due clear`
- `bulk priority <P?>|clear`
- `bulk assignee <value|clear>`
- `bulk project <value|clear>`
- `bulk stage <todo|doing|blocked|done>`
- `bulk delete` (in-app always opens confirm modal, for marked and explicit `id:` targets)
- `help` / `help add|done|due|recur|check|bulk`

CLI query command:
- `list [selectors...] [--sort due|updated|created|title] [--limit N]`

CLI TITS notes:
- Wrapper form: `tadoi add ...`, `tadoi done id:<task-id>`, `tadoi due id:<task-id> ...`, `tadoi recur id:<task-id> ...`, `tadoi check:<op> id:<task-id> ...`, `tadoi bulk:<op> id:<task-id> ...`, `tadoi list ...`
- Raw DSL form: `tadoi 'recur id:<task-id> every:week on:mon'`
- Selector mode for CLI `done` and `due`:
  - `tadoi done +work`
  - `tadoi due +work 2026-03-05 at:09:00`
  - `tadoi due +work due:today clear`
- Selector grammar: `+tag`, `-tag`, `project:<value>`, `assignee:<value>`, `status:open|done|archived|all`, `due:any|overdue|today|next7`, `stage:backlog|todo|doing|in_progress|blocked|review|done`
- Selector mode rejects mixed `id:<task-id>` tokens.
- `list --json` returns structured payload `data.type = "tadoi.list.v1"` in the standard JSON envelope.
- Wrapper help is non-mutating:
  - `tadoi add --help`
  - `tadoi done --help`
  - `tadoi due --help`
  - `tadoi recur --help`
  - `tadoi list --help`
  - `tadoi check:add --help`
  - `tadoi check:toggle --help`
  - `tadoi check:edit --help`
  - `tadoi check:del --help`
  - `tadoi check:clear --help`
  - `tadoi bulk:done --help`
  - `tadoi bulk:tag:add --help`
  - `tadoi bulk:tag:rm --help`
  - `tadoi bulk:due --help`
  - `tadoi bulk:due:clear --help`
  - `tadoi bulk:priority --help`
  - `tadoi bulk:assignee --help`
  - `tadoi bulk:project --help`
  - `tadoi bulk:stage --help`
  - `tadoi bulk:delete --help`
  - `tadoi help --help`
- `@selected` is rejected in CLI context (use `id:<task-id>`, including `check:*` and `bulk:*`)
- Exit codes: `0` success, `2` parse/validation, `3` target resolution, `4` lock present, `5` IO error

## Recurrence Semantics (Behavioral Contract)
- Complete occurrence: add `EXDATE` + materialize done history instance.
- Skip occurrence: add `EXDATE` + remove matching override instance.
- Snooze occurrence: add `EXDATE` + materialize open instance due `+1 day`.
- Checklist toggle on a virtual occurrence: materialize/update override checklist instance (no `EXDATE`).
- Delete occurrence modal: `y` this event, `f` this+future, `n` / `Esc` cancel.
- `E` edits the series definition, not a single occurrence.

## Backup/Import Safety (Behavioral Contract)
- Pre-import backup on commit flows.
- Replace flow requires typed `REPLACE` confirmation.
- Dry-run before destructive import commit.

## Calendar (ICS)

Export:

```bash
bun run start -- calendar:export --out ./tadoi.ics
```

Import:

```bash
bun run start -- calendar:import --in ./tadoi.ics --dry-run
```

In-app Backup Center includes guided Calendar export/import flows.
