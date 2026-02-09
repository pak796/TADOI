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

## Data File

Tasks persist to `todui_data.json` in the project root.

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
