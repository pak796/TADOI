# TADOI™ Installation Guide (macOS, Windows, Linux)

This guide covers binary and source installs on macOS, Windows, and Linux.
Runtime baseline: **v0.4.0-beta.2**.
Manual QA reference: `docs/TADOI_QA_Guide_v0.4.0.md`.
Concise install: see the short install guide in the docs index.

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

## 3) Installable Binaries (Preferred for End Users)

Expected release artifacts:
- macOS: `TADOI-macOS-<version>.dmg` (contains `TADOI-<version>.pkg` + `README.txt`)
- Windows: `TADOI-Setup-x64-<version>.exe`
- Linux: `tadoi_<version>_amd64.deb` and `tadoi-<version>-x86_64.AppImage`
- Per-target manifest: `TADOI-<target>-<version>-manifest.json`
- Per-target checksum file: `SHA256SUMS-<target>.txt`

GitHub download paths:
- Release assets for version tags (`v*`) via the GitHub Actions release workflow
- Per-commit macOS artifacts via `.github/workflows/package-macos.yml`:
  1. Push branch to GitHub.
  2. Trigger **Package macOS Installer** in Actions (or push to `main`).
  3. Download `tadoi-macos-<commit-sha>` artifact from the run.

Install from artifacts:
- macOS:
  1. Open DMG.
  2. Confirm it includes `TADOI-<version>.pkg` and `README.txt`.
  3. Run the included PKG installer.
  4. Open a new terminal session.
  5. Verify in terminal: `tadoi --version`
  6. Completions installed by PKG:
     - Bash: `/usr/local/share/bash-completion/completions/tadoi`
     - Zsh: `/usr/local/share/zsh/site-functions/_tadoi`
     - Fish: `/usr/local/share/fish/vendor_completions.d/tadoi.fish`
- Windows:
  1. Run setup EXE.
  2. Accept UAC prompt (admin install).
  3. Open a new terminal session (required after PATH update).
  4. Verify: `tadoi --version`
- Linux:
  1. Install DEB: `sudo dpkg -i tadoi_<version>_amd64.deb`
  2. Validate binary: `tadoi --version`
  3. Optional AppImage run: `chmod +x tadoi-<version>-x86_64.AppImage && ./tadoi-<version>-x86_64.AppImage --version`
  4. Completions installed by DEB:
     - Bash: `/usr/share/bash-completion/completions/tadoi`
     - Zsh: `/usr/share/zsh/site-functions/_tadoi`
     - Fish: `/usr/share/fish/vendor_completions.d/tadoi.fish`

Verify manifest-backed artifacts:
1. Confirm `TADOI-<target>-<version>-manifest.json` is present in your artifact bundle.
2. Run gate check in repo root:
   - `bun run installer:gate --target macos`
   - `bun run installer:gate --target windows`
   - `bun run installer:gate --target linux`

## 4) Source Install (Developer Workflow)

### 4.1 Get the source

1. Clone your repository:
   - `git clone <YOUR_REPO_URL>`
2. Enter the project directory:
   - `cd TADOI`

### 4.2 Install dependencies

- `bun install`

`bun install` runs a `postinstall` hook that installs user-level shell completions (`bash`, `zsh`, `fish`) using `scripts/install-completions.ts`.

To skip completion install in CI/automation:
- `TADOI_SKIP_COMPLETION_INSTALL=1 bun install`

Manual rerun:
- `bun run completions:install:user`

### 4.3 Run TADOI

- `bun run dev`

Alternative start command:

- `bun run start`

### 4.4 Verify it started correctly

You should see the TADOI interface in your terminal.

Check these basics:

1. Press `a` to open add mode.
2. Type a task title and press `Ctrl+S` to save.
3. Press `?` to open Help.
4. In Help, open `Settings & Themes` and validate settings actions:
   - On `Theme`: press `Enter` (or `ArrowRight`) to open theme settings, then cycle once and return.
   - On `Logo`: press `Enter` to cycle once.
   - On `Flash Mode`, `CRT FX Lite`, `CRT FX Profile`, `Notifications`, `Overdue Popup`, and `Terminal Bell`: press `Enter` once on each row and confirm the on-screen status line changes.
5. Press `/`, type a search term, then press `Enter` (or `Esc`) to close Search.
6. Press `p` to open the boolean tag filter panel, then press `Esc` to close.
7. Press `q` to quit.

If these checks pass, your install is healthy.

Optional notification check:
- Create a timed task due within 1 minute and keep the app open.
- Confirm overdue popup modal appears and responds to `S`/`D`/`G`/`Esc`.

## 4.5 Calendar and Security Quick Checks

1. Run ICS export:
   - `bun run start -- calendar:export --out ./tadoi-install-check.ics`
2. Validate export privacy default:
   - command summary should report `privacy: minimal`.
3. Validate full export mode:
   - `bun run start -- calendar:export --out ./tadoi-install-check-full.ics --privacy full`
4. Validate CLI import flow:
   - `bun run start -- calendar:import --in ./tadoi-install-check.ics --dry-run`
   - expected: summary output with parsed/match/create counters and exit `0`.
5. Validate in-app import flow:
   - `?` -> `1` -> `4) Calendar (ICS)...` -> `2) Import Calendar (.ics)`.
   - expected: dry-run-first commit gating remains enforced.
6. Validate link-open security posture:
   - add a local path link and attempt open from details pane.
   - expected: confirmation prompt (or block message if `security.nonHttpLinkPolicy` is set to `block`).

## 5) Data File Locations by Platform

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

## 6) Recommended First-Time Checks

Run these once after installation:

1. `bun run test`
2. `bun run typecheck`

Optional full validation:

1. `bun run test:coverage`
2. `bun run brand:check`
3. `bun run pack:dry`
4. `bun run pack:inspect`
5. `bun run pack:smoke`

## 7) Build and Packaging Commands

Daily build (artifacts + report):
- `bun run build:daily`

Planner-only mode (default):
- `bun scripts/build-binary.ts --target macos --format raw`
- `bun scripts/build-binary.ts --target windows --format installer`

Real build mode:
- `bun scripts/build-binary.ts --target macos --format raw --mode build`
- `bun scripts/build-binary.ts --target macos --format installer --mode build`
- `bun scripts/build-binary.ts --target windows --format raw --mode build`
- `bun scripts/build-binary.ts --target windows --format installer --mode build`
- `bun scripts/build-binary.ts --target linux --format raw --mode build`
- `bun scripts/build-binary.ts --target linux --format installer --mode build`
- `bun run build:installer:mac:all` (raw binary + DMG/PKG in one command)

Tool prerequisites:
- macOS: `pkgbuild`, `productbuild`, `hdiutil` (Xcode command line tools)
- Windows: Inno Setup compiler (`iscc`)
- Linux: `dpkg-deb` for DEB and `appimagetool` for AppImage (strict requirement in installer build mode)

Optional signing env vars:
- macOS: `TADOI_MAC_SIGN_IDENTITY_INSTALLER`, `TADOI_MAC_NOTARY_PROFILE`
- Windows: `TADOI_WIN_SIGN_CERT_PATH`, `TADOI_WIN_SIGN_CERT_PASSWORD`

Installer manifest gate:
- `bun run installer:gate --target <macos|windows|linux>`

## 8) Troubleshooting

### `bun: command not found`

- Restart terminal after Bun install.
- Ensure Bun is on your `PATH`.
- Re-run Bun install and verify with `bun --version`.

### Install fails on `bun install`

- Retry only if needed:
  - re-run dependency install after clearing local package cache if required
- Confirm network/proxy access to package registries.

### App starts but layout is blocked

- TADOI requires minimum terminal size `104x24`.
- Resize the terminal window larger.

### Startup logs show redacted paths

- This is expected privacy behavior (`~/...` path redaction).
- For full absolute startup paths during debugging, run with:
  - macOS/Linux: `TADOI_VERBOSE_PATH_LOGS=1 bun run dev`
  - Windows PowerShell: `$env:TADOI_VERBOSE_PATH_LOGS=\"1\"; bun run dev`

### Data save errors

- Use Help (`?`) to inspect data path.
- Ensure the target directory is writable.
- Temporarily set `TADOI_DATA_PATH` to a writable directory and retry.

### Windows installer finished but `tadoi` is not found

- The installer updates user `PATH`, but existing terminals keep old environment values.
- Close and reopen terminal, then rerun `tadoi --version`.

### Linux installer build fails for missing `dpkg-deb` or `appimagetool`

- Installer build mode is strict and fails without both tools.
- Debian/Ubuntu example:
  - `sudo apt-get update && sudo apt-get install -y dpkg-dev`
- Install AppImageKit `appimagetool` and ensure it is on `PATH`.
- Re-run:
  - `bun scripts/build-binary.ts --target linux --format installer --mode build`

### macOS DMG smoke check fails

- DMG must contain `TADOI-<version>.pkg` and `README.txt`.
- Ensure package version in `package.json` matches installer filenames under `dist/installers`.
- Rebuild:
  - `bun run build:installer:mac:all`

## 9) Upgrade Workflow

From the project root:

1. `git pull`
2. `bun install`
3. `bun run test`
4. `bun run dev`

## 10) Uninstall

1. Run `tadoi uninstall` or `tadoi --uninstall`.
   - Removes user shell completions installed by `bun install`.
   - Attempts reminder-helper cleanup.
   - Keeps task data, notes, and settings.
2. Remove the main install using the method that originally installed TADOI:
   - macOS PKG/DMG: follow the printed `/usr/local/bin/tadoi` removal step.
   - Windows EXE: uninstall TADOI from Settings > Apps or Control Panel.
   - Linux DEB: remove the package with your distro package manager (example: `sudo apt remove tadoi`).
   - Linux AppImage/manual binary: delete the AppImage or binary you launched.
3. Optionally remove app data files:
   - macOS: `~/Library/Application Support/tadoi/`
   - Windows: `%APPDATA%\\tadoi\\`
   - Linux: `$XDG_DATA_HOME/tadoi/` or `~/.local/share/tadoi/`
4. Optionally remove Bun separately if no longer needed.
