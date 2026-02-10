# Changelog

All notable changes to TADOI are documented in this file.

The format is based on Keep a Changelog.

## [Unreleased]
### Changed
- Added versioned planning artifacts for `v0.2.7`: `TADOI_SPEC_v0.2.7.md` and `TADOI_TASKS_v0.2.7.md`.
- Dashboard layout robustness improved:
  - adaptive 2:1 split with stacked fallback when narrow
  - due-bucket minimum-width guard with friendly placeholder rendering when too narrow

### Fixed
- Replaced direct `process.exit(...)` usage in interactive app exit paths with OpenTUI renderer teardown (`renderer.destroy()`), improving terminal state cleanup on quit.
- Border/frame redraw reliability after dashboard mode toggles and terminal resizes.

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
