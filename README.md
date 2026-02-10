# TADOI

Terminal Accessible Digital Organization Interface

Keyboard-first TUI todo list with due dates, completion, and tag autocomplete (OpenTUI + React on Bun).

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

## Supported Environments

Verified baseline terminals:
- macOS Terminal.app
- iTerm2
- Windows Terminal
- GNOME Terminal (Linux baseline)

Minimum supported terminal size:
- `80x24`
- Below this size, TADOI shows a centered `Terminal too small (min 80x24)` screen and pauses normal interactions until resized.

## Data File

Tasks persist to `tadoi_data.json` using the following resolution order:

- `TADOI_DATA_PATH` override (absolute or relative path)
- Linux: `$XDG_DATA_HOME/tadoi/tadoi_data.json`
- Linux fallback: `$HOME/.local/share/tadoi/tadoi_data.json`
- macOS: `$HOME/Library/Application Support/tadoi/tadoi_data.json`
- Windows: `%APPDATA%\\tadoi\\tadoi_data.json`
- Windows fallback: `$HOME\\AppData\\Roaming\\tadoi\\tadoi_data.json`

The resolved path is shown in startup logs and in the in-app Help panel.

If a save fails (permissions/disk/IO), TADOI keeps running and shows a persistent banner with the error and resolved data path. Saves retry on the next domain mutation (not on UI-only ticks).

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
  - `a`: add task
  - `e`: edit selected task
  - `c`: duplicate selected task
  - `space`: toggle selected task done/open
  - `d`: delete selected task (confirm modal `y` / `n` / `Esc`)
  - `/`: open search
  - `f`: cycle status filter
  - `s`: cycle sort mode
  - `g`: cycle due filter
  - `t`: cycle tag filter across tags on all active (open) tasks
- Saved views:
  - `v`: toggle saved-views overlay
  - `ctrl+s`: open "save current filters as view"
  - `1..9`: apply saved view by slot
  - In overlay: `j`/`k` or arrows move, `Enter` apply, `d` delete, `Esc`/`v` close
- Editor mode:
  - `Tab` / `Shift+Tab`: move between fields
  - `ctrl+s`: save
  - `Esc`: cancel and return to list
  - `right arrow`: accept date/tag/time inline suggestions when present
- Search mode:
  - Type to filter task titles/tags
  - `Enter` or `Esc`: return to list
- Help mode:
  - `H`: cycle theme
  - `Esc` or `?`: close help
- Quit:
  - `q` in LIST mode

## Tag Autocomplete

Type `#` in the Tags field to get suggestions ranked by usage. Selecting a suggestion fills the current tag token.

## Quality Gates / CI

TADOI uses GitHub Actions merge gates on pull requests and pushes to `main`.

Required checks:
- `test`: `bun run test` and `bun run test:coverage`
- `typecheck`: `bun run typecheck`

Local equivalents:

```bash
bun run test
bun run test:coverage
bun run typecheck
```

## Optional Perf Debug

Enable lightweight render metrics logging:

```bash
TADOI_PERF_DEBUG=1 bun run dev
```
