# TADOI™ Feature List (v0.3.8)

This list reflects current runtime behavior as of **2026-02-25**.

## Core Workflow
- Create, edit, duplicate, complete/reopen, and delete tasks.
- Keyboard-first navigation with wrap-around movement, paging, and jump shortcuts.
- Mouse support for key UI surfaces (task rows, menu rows, editor actions, quick filters, overdue modal actions).

## Task Links and Attachments
- Per-task links/attachments with optional labels and inferred kind (`url` or `path`).
- Details pane links focus mode with open, copy, add, edit, and delete flows.
- Add-mode shortcut `Ctrl+L` to attach links before saving a new task.
- External unknown-scheme URL opens are gated behind an explicit confirmation modal.

## Filtering and Views
- Status filter (`f`): `all`, `open`, `done`, `archived`.
- Due filter (`g`): `any`, `overdue`, `today`, `next7`.
- Sort modes (`s`): `DUE`, `UPDATED`, `CREATED`, `TITLE`.
- Search (`/`): live title/tag filtering; closes with `Enter` or `Esc`.
- Saved views: create/apply/delete filter presets (`Ctrl+S`, `v`, `1..9`).

## Tag Filtering
- Priority cycle (`r`) for priority tokens on open tasks.
- Legacy single-tag cycle (`t`) over non-priority tags on open tasks.
- Boolean tag panel (`p`) with three buckets:
  - `ALL (AND)`
  - `ANY (OR)`
  - `NONE (NOT)`
- Priority tokens are excluded from boolean tag filtering.
- Matching precedence: non-empty boolean `tagFilter` overrides legacy single `tag`.

## Left Rail and Branding Surface
- Left rail menu includes `TAG PANEL (P)` with the same action as keyboard `p`.
- Left rail hint strip includes `p: TAG PANEL` for discoverability.
- Logo mode supports `default`, `alternate32`, `alternate_slash32`, `alternate_blocks32`, and `rotating`.
- Rotating logo order includes all four concrete logo variants.
- Blocks logo uses contrast-safe dark ink when accent colors are too light.

## Recurring Tasks
- Recurrence model: `dtstart`, `rrule`, `exdates`, `series_id`.
- Modes: daily, weekly, monthly, custom RRULE.
- End rules: never, until date, count.
- Occurrence actions: complete/reopen (`Space`), skip (`x`), snooze (`z`), edit occurrence (`e`), edit series (`E`).
- Sparse materialization: virtual occurrences render without storing every future instance.

## Dashboard and Analytics
- Dashboard toggle (`b`/`B`) with shared filter parity.
- KPI strip: `OVERDUE`, `TODAY`, `NEXT7`, `OPEN`, `DONE7D`.
- `TOP TAGS (OPEN)` panel with keyboard selection and Enter drilldown.
- Compact fallback rendering on narrow widths.

## Data Safety and Portability
- JSON persistence with schema migration and strict validation (current schema 6).
- Corrupt file recovery with timestamped `.corrupt.*` backups.
- Save-failure banner with retry on next domain mutation.
- In-app Backup Center for export/import with dry-run and replace confirmation gate.

## Calendar Integration
- User-facing CLI export: `calendar:export` with `--out`, `--view`, `--range`, and `--privacy`.
- User-facing in-app calendar flows in Backup Center:
  - `Export Calendar (.ics)`
  - `Import Calendar (.ics)` with dry-run-first commit gating.
- Export privacy modes:
  - `minimal` (default): omit notes/tags/links/url.
  - `full`: include full metadata.
  - `--include-details` compatibility alias to `full`.
- Recurrence-aware ICS export includes RRULE/EXDATE and instance override events.
- User-facing CLI import: `calendar:import` with `--in`, `--view`, `--range`, `--mode`, `--dry-run`, and `--report`.
- Import implementation is recurrence-aware (`icsParser`, `importMapper`, `calendarImportService`) with bounded expansion and deterministic identity precedence.

## Security and Privacy Enhancements
- Persisted security policy: `security.nonHttpLinkPolicy` (`prompt` or `block`).
- Link-open policy is source-aware:
  - calendar-imported links require confirmation before open.
  - non-allowlisted schemes and path/file targets are confirmed or blocked by policy.
- Open target execution rejects control-character payloads and uses argument-based process spawning.
- Startup path logs are redacted by default; opt-in full paths with `TADOI_VERBOSE_PATH_LOGS=1`.

## Notifications and Settings
- Overdue modal queue with actions: snooze, done, go-to, dismiss.
- Optional terminal bell with cooldown.
- Non-interactive engagement toast milestones in the bottom bar (queued, priority-ordered, auto-dismissed).
- Theme registry includes `crtGreen` and `crtAmber` in addition to existing palettes and `rotating` mode.
- Help Settings page includes: `Theme`, `Logo`, `Flash Mode`, `CRT FX Lite`, `CRT FX Profile`, `Notifications`, `Overdue Popup`, `Terminal Bell`.
- CRT FX Lite applies profile-based tint/flicker treatment to primary panel surfaces (left rail, task list panel, details panel).
- Persisted settings include theme/logo/flash/CRT FX/notification/security values.
- `crtFxLite` persists only when enabled; default CRT profile (`green` + `normal`) is omitted from `settings.json`.
- Persisted engagement state and unlock tracking for milestone toasts.

## Platform and Runtime Contracts
- Supported baseline terminals: macOS Terminal/iTerm2, Windows Terminal, GNOME Terminal.
- Minimum supported terminal size: `104x24`.
- Below minimum, app shows blocking guard: `Terminal too small (min 104x24)`.

## Version Surface
- App version: `v0.3.8`.
- Package version: `0.3.8`.
