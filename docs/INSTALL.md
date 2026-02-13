# TADOI™ Install Guide

Verified as of 2026-02-13 (v0.3.6).

This is the concise install guide. For deep troubleshooting and platform detail, see `docs/TADOI_Installation_Guide_All_Platforms.md`.

## Prerequisites
- Bun `>=1.3.9`
- Git
- Terminal: macOS Terminal.app or iTerm2, Windows Terminal, GNOME Terminal (or equivalent)

## Install From Release Artifacts (Preferred)
Expected artifacts:
- macOS: `TADOI-macOS-<version>.dmg` (contains `TADOI-<version>.pkg`)
- Windows: `TADOI-Setup-x64-<version>.exe`
- Linux: `tadoi_<version>_amd64.deb` and/or `tadoi-<version>-x86_64.AppImage`

Quick verify:
- `tadoi --version`

## Install From Source (Developer)

```bash
bun install
bun run dev
```

## Daily Build Artifacts
When running `bun run build:daily`, artifacts are staged under:
- `dist/artifacts/YYYY-MM-DD/<platform>/...`

The build report is written to:
- `dist/artifacts/YYYY-MM-DD/BUILD_REPORT.md`

## First-Run Sanity Checks
1. `?` opens Help.
2. `a` opens Add; `Ctrl+S` saves.
3. `/` opens Search; `Enter` or `Esc` closes.
4. `p` opens the boolean tag filter panel.
5. `q` quits (LIST mode).

If any step fails, check `docs/TADOI_QA_Guide_v0.3.6.md` or the QA quicklists in `docs/QA/`.
