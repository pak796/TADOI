# Changelog

All notable changes to TADOI are documented in this file.

The format is based on Keep a Changelog.

## [Unreleased]
### Added
- In-app `Backup Center` flow (Help -> `1` -> `DATA: Backup / Export / Import`) with:
  - timestamped backup export
  - guided import flow (path -> mode -> optional `REPLACE` confirmation -> dry-run -> commit)
  - in-app data-path readout
  - replace confirmation gate and dry-run-before-commit enforcement
- Shared portability service (`src/state/backupService.ts`) used by both CLI and TUI, preserving existing import/export semantics.
- Tier 1/2 notifications while app is open:
  - in-app overdue popup modal queue (actionable controls: snooze, mark done, go to task, dismiss)
  - optional terminal bell (`\x07`) with cooldown control when overdue modal events are surfaced
  - Help-mode notification toggles (`n`/`o`/`l`)
- Tier 3 notification scaffold:
  - no-op OS notifier adapter boundary for future platform integrations
- Overdue action helpers for notification modal flows:
  - `snooze` applies +10 minute overdue defer semantics
  - `mark done` applies occurrence-aware completion semantics
  - `go to task` resolves recurring-row fallbacks for reliable reveal behavior

### Changed
- Version surfaces are now aligned to `0.2.9` / `v0.2.9` in app/runtime docs.
- Backup Center copy/layout polish for clearer step labels, safety messaging, and action hints.
- Documentation refreshed for Backup Center usage and keybindings (`README.md`, in-app Help text).
- Theme system now includes additional concrete palettes (`lightSlate`, `paperWhite`, `midnightBlack`) in both manual cycling and rotating mode.
- Theme registry expanded with additional accessibility and brand palettes:
  - `deuteranopia`, `protanopia`, `tritanopia`
  - `blueAngels`, `southwest`, `rams`
- Editor recurrence controls support keyboard left/right cycling for repeat mode and repeat-end mode, with clamp behavior at range bounds.
- Settings schema now includes `notifications.*` preferences with backward-compatible defaults and portability/import-export support.

### Fixed
- Help pane section navigation now keeps the selected section visible while moving with arrow keys, with page-based navigation support (`Ctrl+U`/`Ctrl+D`) in Help mode.
- Help pane row spacing/layout no longer inserts extra blank spacer rows, improving visual consistency and scroll-follow behavior.

## [0.2.8]
### Added
- Recurring tasks end-to-end (schema v4):
  - RRULE-style recurrence metadata on tasks (`dtstart`, `rrule`, `exdates`, `series_id`)
  - Materialized instance rows via `instance_of` for per-occurrence overrides/history
  - Recurrence engine + selector with sparse virtual occurrence expansion
  - New list actions: `x` (skip occurrence), `z` (snooze occurrence), `E` (edit series)
  - Editor recurrence controls (daily/weekly/monthly/custom, end conditions, preview next 3)
- Flash mode preference (`slow`/`static`) with persistence in `settings.json` and Help-panel toggle (`M`).
- Task-list row mouse selection (left-click) using the same highlighted row hitbox.
- Left-rail `MENU` row mouse actions (left-click) using the same highlighted menu-row hitbox.
- Dashboard `TOP TAGS (OPEN)` widget with keyboard selection (`up`/`down`) and Enter drilldown to the shared `tag` filter.
- Dashboard KPI strip above widgets:
  - `OVERDUE`, `TODAY`, `NEXT7`, `OPEN`, `DONE7D`
  - Unicode block-element meters with compact fallback on narrow terminals
- Bottom rotating info bar quick filters:
  - clickable due buckets (`OVERDUE`, `DUE TODAY`, `DUE THIS WEEK`)
  - clickable tag pills
  - click-active-again clears the applied quick filter
- Add/Edit pane scroll containment:
  - split editor into scrollable content region + fixed footer region
  - focus-aware auto-scroll for editor fields
  - editor page scrolling via `ctrl+u`/`ctrl+d` and `PageUp`/`PageDown`

### Changed
- Task list/dashboard now render recurrence-aware visible rows (single source of truth for filters).
- Dashboard/top-tags/KPI counts consume recurrence-expanded rows, keeping list and dashboard in sync for recurrence windows.
- Persistence/validation/migration/portability updated for recurrence fields and schema version `4`.
- Added versioned planning artifacts for `v0.2.8`: `TADOI_SPEC_v0.2.8.md` and `TADOI_TASKS_v0.2.8.md`.
- Dashboard layout robustness improved:
  - adaptive 2:1 split with stacked fallback when narrow
  - due-bucket minimum-width guard with friendly placeholder rendering when too narrow
- Dashboard right panel changed from backlog trend to `TOP TAGS (OPEN)` Pareto-style bars with aligned label/bar columns.
- KPI strip now uses full-width cell distribution so all KPI columns fill the strip container consistently.
- KPI styling now uses semantic colors:
  - `OVERDUE`, `TODAY`, `NEXT7`, `OPEN` in blue
  - `DONE7D` in green
- Default `DUE` sorting now prioritizes open tasks with due dates at the top before other status/due combinations.
- In `static` flash mode, overdue indicators render as solid red (no pulsing).
- `b` / `B` dashboard toggle is now ignored in text-entry contexts (`SEARCH`, `ADD`, `EDIT`, and save-view name prompt).
- Repeat mode selector chips (`OFF`, `DLY`, `WLY`, `MLY`, `CUS`) now use width-sharing layout to stay on one line in the editor pane.
- Version surfaces are aligned to `0.2.8` / `v0.2.8`.

### Fixed
- Replaced direct `process.exit(...)` usage in interactive app exit paths with OpenTUI renderer teardown (`renderer.destroy()`), improving terminal state cleanup on quit.
- Border/frame redraw reliability after dashboard mode toggles and terminal resizes.
- Editor Save/Cancel mouse interactions now use OpenTUI mouse events (`onMouseDown`) instead of unsupported `onClick`.
- Bottom rotating info-bar pill borders now size correctly without pushing content out of the bar region.
- Add/Edit pane fields no longer clip/overlap into footer hints at constrained heights; footer actions remain visible.

## [0.2.7]
### Added
- Dashboard mode (`b` / `B`) with two analytics widgets:
  - 8-bucket due chart (overdue, today, +1..+6 days)
  - 7-day backlog trend reconstruction
- Shared filter parity between list and dashboard using the same visible-task selector (`status`, `due`, `tag`, and `searchText` when present).
- CLI full-state portability commands:
  - `tadoi export --out ...`
  - `tadoi import --in ...`
  - merge/replace modes, dry-run support, and backup-before-overwrite safety.
- Product-wrapper documentation for contribution policy, support intake, and release tracking.

### Changed
- In-app Help and README keybindings now document dashboard usage and data portability commands.
- Left rail/menu mode and focus surfaces now include `DASHBOARD`.
- Version surfaces now aligned to `0.2.7` / `v0.2.7`.

### Fixed
- Key-routing leakage prevention for dashboard mode so list navigation keys do not fire while dashboard is focused.

## [0.2.5]
### Added
- Daily-driver list navigation primitives (`gg`/`G`, paging, overdue/today jumps).
- Saved Views filter presets with persistence and migration support.
- Packaging readiness workflow (`pack:dry`, `pack:inspect`, `pack:smoke`) and CI package gate.

### Changed
- Sort-mode cycling and global active-tag filter cycling behavior.
- Version surfaces and package metadata alignment to `0.2.5`.

### Fixed
- Selection stability by task id across filter/search/sort changes.
- Help/readability polish for high-contrast and task-list UI details.

## [0.2.4]
### Added
- Platform contract documentation (baseline terminals and minimum size `80x24`).
- Persistent save-failure banner and retry-on-next-domain-mutation behavior.
- Performance debug instrumentation (`TADOI_PERF_DEBUG=1`).

### Fixed
- Persistence interruption and recovery test coverage for real-user reliability cases.

## [0.2.3]
### Added
- Formal mode/focus model with centralized key routing and Esc unwind behavior.
- CI merge gates for test coverage and typecheck.

### Changed
- Versioning discipline across app and package surfaces.
- UI state routing boundaries to prevent key leakage across modes.

### Fixed
- Modal correctness for blocking delete confirmations and deterministic outcomes.

## [0.2.2]
### Added
- Corruption recovery path with automatic backup files (`*.corrupt.YYYYMMDD-HHMMSS`).
- Cross-platform standardized data-path resolution and explicit data-path surfacing.

### Changed
- Schema migration/validation discipline for persisted state.

### Fixed
- Corrupt JSON and invalid-shape recovery behavior to keep app startup resilient.

## [0.2.1]
### Added
- Date/time ergonomics (due-time handling and inline autocomplete improvements).
- Tag normalization and autocomplete ranking updates.

### Changed
- Theme/settings and due-label behavior refinement for day-based UX.

### Fixed
- Local-day and DST-sensitive date logic edge cases.

## [0.2.0]
### Added
- Initial polished MVP hardening layer for focus model, modal correctness, and selection-following scroll.
- Keyboard-first task workflow with list/editor/help/search mode structure.

### Fixed
- Scroll and selection visibility behavior under navigation/filter/resize changes.
