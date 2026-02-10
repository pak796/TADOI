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

### Data Backup and Corrupt Recovery

Where your data lives:
- Use the resolved data path shown at startup or in the Help panel.
- By default, it follows the OS-specific locations listed above.

How to back it up:

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

## Pre-release Packaging (Non-Live)

TADOI currently uses a non-live packaging workflow:
- Public publish is intentionally disabled (`"private": true` in `package.json`).
- Distribution for testers is done via local/private tarball install.
- This project is source-available under PolyForm Noncommercial 1.0.0 (noncommercial use only).

Build and validate packaging artifacts:

```bash
bun run pack:dry
bun run pack:inspect
bun run pack:smoke
```

Install from generated tarball (example):

```bash
bun add -g ./dist/tarball/tadoi-0.2.5.tgz
tadoi --help
```

### Cross-platform test install (macOS / Windows / Linux)

Build machine (create artifact):

```bash
bun run pack:dry
```

Copy `dist/tarball/tadoi-0.2.5.tgz` to the target test machine, then install:

macOS/Linux:

```bash
bun --version
bun add -g ./tadoi-0.2.5.tgz
tadoi --help
tadoi
```

Windows (PowerShell):

```powershell
bun --version
bun add -g .\tadoi-0.2.5.tgz
tadoi --help
tadoi
```

If `tadoi` is not found, ensure Bun's global bin is on `PATH`:
- macOS/Linux: `export PATH="$HOME/.bun/bin:$PATH"`
- Windows PowerShell: `$env:Path += ";$env:USERPROFILE\.bun\bin"`

### Uninstall (Global Install)

```bash
bun remove -g tadoi
```

Windows PowerShell:
```powershell
bun remove -g tadoi
```

Release-candidate gate (local):

```bash
bun run release:rc:check
```

## Future Installers (Planned)

Installer outputs are scaffolded for future phases:
- macOS binary/DMG track: `packaging/macos/README.md`
- Windows binary/EXE/MSI track: `packaging/windows/README.md`

Scaffold commands (no real installers generated yet):

```bash
bun run build:bin:mac
bun run build:bin:win
```

Current scaffold outputs:
- `dist/bin/macos/`
- `dist/bin/windows/`
- `dist/installers/` (reserved for future DMG/EXE artifacts)

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
