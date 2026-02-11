# TADOI Installation Guide (macOS, Windows, Linux)

This guide covers installing and running TADOI from source on all supported platforms in one place.

## 1) What You Need

- A terminal:
  - macOS: Terminal.app or iTerm2
  - Windows: Windows Terminal (PowerShell recommended)
  - Linux: GNOME Terminal (or equivalent)
- Bun `>= 1.3.9`
- Git

## 2) Install Bun

Official install docs: [https://bun.sh/docs/installation](https://bun.sh/docs/installation)

Quick install commands:

- macOS/Linux:
  - `curl -fsSL https://bun.sh/install | bash`
- Windows (PowerShell):
  - `powershell -c "irm bun.sh/install.ps1 | iex"`

Verify:

- `bun --version`

## 3) Get the TADOI Source

1. Clone your repository:
   - `git clone <YOUR_REPO_URL>`
2. Enter the project directory:
   - `cd TUI_TODO`

## 4) Install Dependencies

- `bun install`

## 5) Run TADOI

- `bun run dev`

You can also run:

- `bun run start`

## 6) Verify It Started Correctly

You should see the TADOI interface in your terminal.

Check these basics:

1. Press `a` to open add mode.
2. Type a task title and press `Ctrl+S` to save.
3. Press `?` to open Help.
4. While Help is open, test quick toggles:
   - `h`/`H` theme cycle
   - `m`/`M` flash mode
   - `n`/`N` notifications master
   - `o`/`O` overdue popup
   - `l`/`L` terminal bell
5. Press `q` to quit.

If those work, install/run is healthy.

Optional notification check:
- Create a timed task due within 1 minute and keep the app open.
- Confirm overdue popup modal appears and responds to `S`/`D`/`G`/`Esc`.

## 7) Data File Locations by Platform

Default data path resolution:

- macOS:
  - `~/Library/Application Support/tadoi/tadoi_data.json`
- Windows:
  - `%APPDATA%\\tadoi\\tadoi_data.json`
  - fallback: `%USERPROFILE%\\AppData\\Roaming\\tadoi\\tadoi_data.json`
- Linux:
  - `$XDG_DATA_HOME/tadoi/tadoi_data.json`
  - fallback: `~/.local/share/tadoi/tadoi_data.json`

Override location on any platform with `TADOI_DATA_PATH`.

Examples:

- macOS/Linux:
  - `TADOI_DATA_PATH=/tmp/tadoi_data.json bun run dev`
- Windows PowerShell:
  - `$env:TADOI_DATA_PATH="$env:TEMP\\tadoi_data.json"; bun run dev`

## 8) Recommended First-Time Checks

Run these once after installation:

1. `bun run test`
2. `bun run typecheck`

Optional full validation:

1. `bun run test:coverage`
2. `bun run brand:check`
3. `bun run pack:dry`
4. `bun run pack:inspect`
5. `bun run pack:smoke`

## 9) Troubleshooting

### `bun: command not found`

- Restart terminal after Bun install.
- Ensure Bun is on your `PATH`.
- Re-run Bun install and verify with `bun --version`.

### Install fails on `bun install`

- Delete lockfile cache only if needed and retry:
  - `bun install --force`
- Confirm network/proxy access to package registries.

### App starts but layout is blocked

- TADOI requires minimum terminal size `80x24`.
- Resize the terminal window larger.

### Data save errors

- Use Help (`?`) to inspect data path.
- Ensure the target directory is writable.
- Temporarily set `TADOI_DATA_PATH` to a writable directory and retry.

## 10) Upgrade Workflow

From the project root:

1. `git pull`
2. `bun install`
3. `bun run test`
4. `bun run dev`

## 11) Uninstall (Source Install)

1. Delete the project folder.
2. Optionally remove app data files:
   - macOS: `~/Library/Application Support/tadoi/`
   - Windows: `%APPDATA%\\tadoi\\`
   - Linux: `$XDG_DATA_HOME/tadoi/` or `~/.local/share/tadoi/`
3. Optionally remove Bun separately if no longer needed.
