# TADOI™ Support

## Where to Report Issues

Report bugs and support requests via GitHub Issues in this repository.

## Before Filing

- Check the README first (environment requirements, packaging/install steps, and data-path behavior).
- Confirm you are on a supported terminal and minimum size (`104x24`).
- Reproduce once on the latest `0.3.9` release (or latest main commit if testing unreleased changes).

## What to Include in a Bug Report

Please include:

- OS and terminal app (`Terminal.app`, `iTerm2`, `Windows Terminal`, `GNOME Terminal`, etc.).
- App version (shown in Help panel / startup info).
- Install method (for example: `bunx`, `npm`/tarball install, binary/installer, or local dev run).
- Terminal size in `cols x rows`.
- Resolved data path shown by the app.
- Clear steps to reproduce.
- Expected behavior vs actual behavior.
- Any relevant error banner text or redacted log output.

## Data Safety and Redaction

- Do not paste personal task content directly into issues.
- Redact titles, notes, tags, and file paths where needed.
- If corruption recovery occurs, mention the backup filename pattern:
  - `tadoi_data.json.corrupt.YYYYMMDD-HHMMSS` (or with numeric suffix).

This is usually enough for maintainers to triage without exposing private task data.
