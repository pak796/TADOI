# TADOI™ Usage Guide

Verified as of 2026-02-20 (v0.3.7).
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

Key token aliases (as reported by router/terminal): `/` `?` `C` `T` `[` `]` `{` `}` `backspace` `page_up` `page_down` `pageup` `pagedown` `prior` `next` `r` `u`.
Compatibility aliases currently routed in key handlers: `C` `L` `O` `T` `r` `u`.


LIST mode navigation:
- `j` / `k` / `ArrowUp` / `ArrowDown`: move selection
- `gg`: jump to top
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
- `t` / `T`: cycle non-priority tag filter
- `p`: open boolean tag filter panel
- `b` / `B`: toggle Dashboard

Details links focus (Tab from list):
- `Tab` / `Shift+Tab`: toggle focus list <-> details
- `ArrowUp` / `ArrowDown` / `j` / `k`: move selection
- `Enter` / `o`: open selected link/path
- `c`: copy selected link
- `l`: add link, `e`: edit link, `d` / `backspace`: remove link
- `Esc`: return focus to list

DASHBOARD mode:
- `b` / `B`: return to list
- `f` / `g` / `r` / `t` / `p`: same filter cycling as list
- `ArrowUp` / `ArrowDown`: select top-tag rows
- `Enter`: apply selected dashboard tag
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

SEARCH mode:
- Type to filter
- `Enter` or `Esc`: return to list

HELP mode:
- `1`: open Backup Center
- `ArrowUp` / `ArrowDown`: move section
- `ArrowLeft` / `ArrowRight`: collapse/expand section
- `Enter` / `Space`: toggle section
- `Enter` / `ArrowRight` on Settings: open settings pages
- In settings pages: `ArrowUp` / `ArrowDown` move, `Enter` / `ArrowRight` apply/select, `ArrowLeft` / `backspace` / `Esc` back
- `Ctrl+U` / `Ctrl+D` / `page_up` / `page_down`: page help content
- `Esc` or `?`: close Help

BACKUP_CENTER mode:
- `1` / `2` / `3` / `4`: choose root menu option
- Number keys choose on-screen options
- `j` / `k`: move menu selection
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
- `help` / `help add|done|due|recur`

CLI TITS notes:
- Wrapper form: `tadoi add ...`, `tadoi done id:<task-id>`, `tadoi due id:<task-id> ...`, `tadoi recur id:<task-id> ...`
- Raw DSL form: `tadoi 'recur id:<task-id> every:week on:mon'`
- `@selected` is rejected in CLI context (use `id:<task-id>`)
- Exit codes: `0` success, `2` parse/validation, `3` target resolution, `4` lock present, `5` IO error

## Recurrence Semantics (Behavioral Contract)
- Complete occurrence: add `EXDATE` + materialize done history instance.
- Skip occurrence: add `EXDATE` + remove matching override instance.
- Snooze occurrence: add `EXDATE` + materialize open instance due `+1 day`.
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
