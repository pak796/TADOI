# Changelog

All notable changes to TADOI are documented in this file.

The format is based on Keep a Changelog.

## [Unreleased]
### Added
- Product-wrapper documentation for contribution policy, support intake, and release tracking.

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
