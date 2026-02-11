# TADOI™ Installable Distribution Spec (Bun + OpenTUI Terminal TUI)

**Scope:** Produce end-user **installable/distributable** builds for a Bun-based terminal TUI app (OpenTUI + React), including **Windows EXE installer**, **macOS DMG (preferred)**, and **Linux AppImage + DEB**.  
**Non-goal:** A native desktop GUI app bundle. This is a **terminal-first** product.

---

## 1) Current State (repo reality)

### Runtime and entrypoints
- **Runtime:** Bun (not pure Node CLI). `package.json` declares `engines.bun >= 1.3.9`.
- **CLI entrypoint:** `src/cli.ts` routes headless commands and version/smoke flags.
- **TUI runner:** `src/tui/runTui.tsx` starts OpenTUI runtime for interactive mode.
- **Bootstrap:** `src/index.tsx` delegates into CLI routing.
- **Shim:** `bin/tadoi.js` launches the project runtime command path.

### Native/prebuilt components
- No local `node-gyp` / `binding.gyp` build flow in this repo.
- However, `@opentui/core` resolves **platform-specific optional packages**:
  - `@opentui/core-darwin-*`
  - `@opentui/core-linux-*`
  - `@opentui/core-win32-*`
- Implication: builds must be **validated per OS/arch**; avoid “single binary for all platforms” assumptions.

---

## 2) Distribution Goals

### User-facing artifacts
| Platform | Primary artifact | Secondary artifacts (optional) |
|---|---|---|
| Windows | `TADOI-Setup-x64.exe` | `TADOI-x64.msi`, portable zip |
| macOS | `TADOI-macOS-<ver>.dmg` **(preferred)** | `.pkg` inside DMG, portable tarball |
| Linux | `tadoi-<ver>.AppImage` + `tadoi_<ver>_amd64.deb` | `.rpm`, snap, flatpak |

### UX outcomes
- After install, user can run:
  - `tadoi` (interactive TUI)
  - `tadoi export …` / `tadoi import …` (headless CLI subcommands)
- End users should **not need Bun** installed.

---

## 3) Build Strategy

### 3.1 Primary approach: Bun-compiled executables
Build a per-platform executable using Bun’s compile/executable output feature (exact CLI flags may evolve; treat as implementation detail).

**Key rule:** Build on the **native OS** for correctness of OpenTUI optional platform packages:
- Windows builds run on Windows runners
- macOS builds run on macOS runners
- Linux builds run on Linux runners

### 3.2 Entrypoint contract
The compiled binary must behave as:
- `tadoi` → launches TUI
- `tadoi --version` → prints version, **no TUI initialization**
- `tadoi export --help` → works headless, **no TUI initialization**

Current layout already separates CLI routing from TUI startup, which prevents accidental TUI initialization in headless installer and CI paths.

---

## 4) macOS Packaging (DMG preferred)

### 4.1 DMG structure (recommended)
Ship a DMG as the primary download containing:
- `TADOI.pkg` (signed + notarized + stapled)
- `README.txt` (install/uninstall instructions)
- `Uninstall.command` (optional convenience script)
- `tadoi` binary (optional “portable” fallback)

**Rationale:** DMG is the user-facing container; the `.pkg` inside provides the most reliable privileged install flow for a CLI tool.

### 4.2 Install location & PATH
**Default install path:** `/usr/local/bin/tadoi`  
This supports both Intel and Apple Silicon Macs without depending on Homebrew layout.

Optional enhancement:
- If `/opt/homebrew/bin` exists, create a symlink there as well (only if non-invasive and well-tested).

### 4.3 Signing, notarization, and Gatekeeper
Requirements:
- Sign `TADOI.pkg` with **Developer ID Installer**
- Notarize with Apple notary service
- Staple the notarization ticket to the `.pkg`
- Optionally notarize and staple the `.dmg` container too

### 4.4 Uninstall behavior
Documented uninstall must remove:
- `/usr/local/bin/tadoi` (and any symlinks)
- User data/config/logs (see §9), **only on explicit user request**

---

## 5) Windows Packaging (EXE installer)

### 5.1 Installer format
**MVP:** Inno Setup or NSIS producing `TADOI-Setup-x64.exe`

### 5.2 Install behavior
- Install directory: `C:\Program Files\TADOI\`
- Binary: `tadoi.exe`
- Add to PATH (prefer **user PATH** by default; allow system PATH as an advanced option)
- Add uninstall entry to Apps & Features

### 5.3 Signing
- Authenticode-sign the installer (and optionally the primary EXE)
- Timestamp signatures for longevity

---

## 6) Linux Packaging

### 6.1 AppImage (portable)
- Produces `tadoi-<ver>.AppImage`
- Must run without root on common distros (Ubuntu LTS target)

### 6.2 DEB (first-class install)
- Produces `tadoi_<ver>_amd64.deb`
- Installs `tadoi` into `/usr/bin/tadoi`
- Adds bash/zsh completions later (optional)

### 6.3 Optional: RPM / Snap / Flatpak
Only if you want broader distro/store support.
- RPM: Fedora/RHEL ecosystems
- Snap/Flatpak: store distribution and sandboxing (less common for CLI-first tools)

---

## 7) CI/CD (Release Engineering)

### 7.1 Build matrix (GitHub Actions recommended)
- `windows-latest` (x64)
- `macos-latest` (arm64; optionally add x64 strategy if you ship Intel binaries)
- `ubuntu-latest` (x64)

### 7.2 Pipeline stages
1. **Install deps** (deterministic)
   - `bun install --frozen-lockfile` (or your equivalent)
2. **Validate OpenTUI platform resolution**
   - Verify expected `@opentui/core-<platform>` package is present/resolved
3. **Build compiled binary**
   - Output to `dist/bin/<target>/`
4. **Smoke tests**
   - `tadoi --version`
   - `tadoi export --help`
   - TUI smoke: `tadoi --smoke-tui` (recommended flag) that renders one frame and exits
5. **Package installers**
   - Windows EXE installer
   - macOS DMG containing notarized PKG
   - Linux AppImage + DEB
6. **Signing + notarization**
7. **Publish release**
   - Upload artifacts + `SHA256SUMS.txt`
   - Include release notes

---

## 8) Repo Integration (your existing scaffolds)

### 8.1 `scripts/build-binary.ts` (current: planner-only)
**Current behavior (planner-only):**
- Flags:
  - `--target` must be `macos` or `windows` (line refs: `:4`, `:13-17`)
  - `--format` must be `raw` or `installer` (line refs: `:5`, `:19-23`)
  - Invalid/missing values → error + exit code `1`
- Output naming:
  - `raw` → `dist/bin/<target>/BUILD_PLAN.txt` (`:35-37`)
  - `installer` → `dist/installers/<TARGET_UPPER>_INSTALLER_PLAN.txt` (`:54`)
- Writes plan artifacts only; explicitly states no native binary/installer is produced (`:45-47`, `:63-66`).

**Spec-required evolution:**
- Add `linux` target (parity with distro requirements)
- Keep plan mode, but implement “execute mode”:
  - `--format raw` → produce compiled executable in `dist/bin/<target>/`
  - `--format installer` → produce final installer artifacts in `dist/installers/`
- Use `packaging/release-targets.json` as the source of output dirs/status gates.

### 8.2 `packaging/release-targets.json` (current: metadata)
- `version: 1` (`:2`)
- Targets:
  - `tarball` → `status: active`, `outputDir: dist/tarball` (`:5-9`)
  - `binary-macos` → `status: planned`, `outputDir: dist/bin/macos`, `installerOutputDir: dist/installers` (`:11-16`)
  - `binary-windows` → `status: planned`, `outputDir: dist/bin/windows`, `installerOutputDir: dist/installers` (`:18-23`)
- No CLI flags; declarative only.

**Spec-required evolution:**
- Add `binary-linux` target with `outputDir` + `installerOutputDir`
- Add artifact naming metadata (recommended fields):
  - `artifactBaseName`, `arch`, `signingRequired`, `notarizeRequired`, `formats`

---

## 9) Runtime Filesystem Contract (config/data/logs)

Define stable paths now to avoid later migration pain.

### Recommended defaults
- **Windows**
  - Config/data: `%APPDATA%\TADOI\`
  - Logs: `%LOCALAPPDATA%\TADOI\logs\`
- **macOS**
  - Config/data: `~/Library/Application Support/TADOI/`
  - Logs: `~/Library/Logs/TADOI/`
- **Linux**
  - Config/data: `$XDG_CONFIG_HOME/tadoi` (fallback `~/.config/tadoi/`)
  - Logs: `$XDG_STATE_HOME/tadoi/logs` (fallback `~/.local/state/tadoi/logs/`)

### Requirements
- Never require admin privileges for normal runtime
- Provide env var overrides (optional): `TADOI_HOME`, `TADOI_CONFIG_DIR`, etc.

---

## 10) Acceptance Criteria

### Build correctness
- CI produces artifacts for each target platform reliably.
- Platform-specific OpenTUI dependencies resolve correctly on that platform.

### Runtime behavior
- `tadoi --version` prints quickly and exits 0.
- `tadoi export/import` works in a headless environment.
- `tadoi` launches a stable TUI in:
  - Windows Terminal
  - macOS Terminal + iTerm2
  - Ubuntu default terminal

### Install behavior
- Windows EXE installer:
  - Adds `tadoi` to PATH
  - Clean uninstall
- macOS DMG:
  - DMG opens
  - `.pkg` installs to `/usr/local/bin/tadoi`
  - Installer is signed + notarized (no scary dialogs beyond first-run expectations)
- Linux:
  - AppImage runs without root
  - `.deb` installs and places `tadoi` on PATH

### Release hygiene
- Release includes `SHA256SUMS.txt`
- Release notes include install/uninstall steps per OS

---

## 11) MVP Task Breakdown (implementation plan)

1. **Add “smoke mode”**
   - Implement `--smoke-tui` to render one frame and exit
2. **Implement real raw builds**
   - Extend `scripts/build-binary.ts` to compile binaries into `dist/bin/<target>/`
3. **Implement macOS DMG packaging**
   - Create notarized `.pkg`
   - Place `.pkg` inside DMG as primary UX
4. **Implement Windows installer**
   - Inno/NSIS script, PATH support, signing hook points
5. **Implement Linux packaging**
   - AppImage + `.deb`
6. **CI matrix + releases**
   - Automate builds, signing/notarization steps, publish artifacts

---

## 12) Open Questions (should be decided early)
- Do you ship **Intel macOS** builds or Apple Silicon only?
- Do you want “system install” (`/usr/local/bin`) only, or also “user install” (`~/.local/bin`)?
- Do you want auto-update (`tadoi update`) or rely on package managers later (winget/homebrew/apt)?
