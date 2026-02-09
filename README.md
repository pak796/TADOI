# ToDui

Keyboard-first TUI todo list with due dates, completion, and tag autocomplete (OpenTUI + React on Bun).

## Setup

```bash
bun install
```

## Run

```bash
bun run dev
```

## Supported Environments

Verified baseline terminals:
- macOS Terminal.app
- iTerm2
- Windows Terminal
- GNOME Terminal (Linux baseline)

Minimum supported terminal size:
- `80x24`
- Below this size, ToDui shows a centered `Terminal too small (min 80x24)` screen and pauses normal interactions until resized.

## Data File

Tasks persist to `todui_data.json` using the following resolution order:

- `TODUI_DATA_PATH` override (absolute or relative path)
- Linux: `$XDG_DATA_HOME/todui/todui_data.json`
- Linux fallback: `$HOME/.local/share/todui/todui_data.json`
- macOS: `$HOME/Library/Application Support/todui/todui_data.json`
- Windows: `%APPDATA%\\todui\\todui_data.json`
- Windows fallback: `$HOME\\AppData\\Roaming\\todui\\todui_data.json`

The resolved path is shown in startup logs and in the in-app Help panel.

If a save fails (permissions/disk/IO), ToDui keeps running and shows a persistent banner with the error and resolved data path. Saves retry on the next domain mutation (not on UI-only ticks).

## Keybindings

- `j`/`k` or arrows: move selection
- `a`: add task
- `e`: edit task
- `space`: toggle done
- `d`: delete (confirm with `y`/`n`)
- `/`: search
- `f`: cycle status filter
- `g`: cycle due filter
- `t`: toggle tag filter (uses selected task tag)
- `?`: help
- `q`: quit

## Tag Autocomplete

Type `#` in the Tags field to get suggestions ranked by usage. Selecting a suggestion fills the current tag token.

## Quality Gates / CI

ToDui uses GitHub Actions merge gates on pull requests and pushes to `main`.

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
TODUI_PERF_DEBUG=1 bun run dev
```
