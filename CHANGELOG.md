# TADOI™ Changelog

All notable changes to TADOI are documented in this file.

The format is based on Keep a Changelog.

## [Unreleased]
### Added
- Backup Center now includes `Cloud Backups -> GitHub (CLI)` with:
  - connect flow (create private repo or use existing personal repo),
  - status panel (`gh` detect/login/account/repo/last push/last restore),
  - manual `Push snapshot now`,
  - `Restore from GitHub` snapshot picker routed into existing JSON dry-run -> commit gates.
- New GitHub CLI cloud backup adapter (`src/backup/githubCli.ts`) for:
  - `gh` detection/auth status checks,
  - personal owner enforcement,
  - repo privacy checks,
  - snapshot list/download/push operations.
- Notes runtime file watching with polling fallback (`src/notes/watch.ts`) to replace
  fixed-interval full-tree refresh.
- Snapshot payload encryption/decryption support for GitHub cloud backups using
  `TADOI_GITHUB_SNAPSHOT_PASSPHRASE`.
- Redacted logger module (`src/logging/redactedLogger.ts`) plus modal-flow integration
  coverage for encrypted push + restore.

### Changed
- Settings schema/normalization now includes non-secret `githubBackup` config with safe defaults:
  - `enabled`, `ownerRepo`, `branch`, `deviceId`, `pathPrefix`, `autoPushPolicy`, `lastPushed`.
- Backup Center calendar submenu now includes the GitHub cloud backup entry.
- Backup Center GitHub status now shows snapshot encryption state (`on`/`off`).
- CLI command surfaces now emit through the redacted logger.

### Fixed
- GitHub CLI adapter process spawn now forwards runtime environment (`PATH`) and
  supports Bun stdin sink semantics for `gh api --input -`.

## [0.3.9] - 2026-02-27
### Added
- New active versioned documentation artifacts:
  - `TADOI_SPEC_v0.3.9.md`
  - `TADOI_TASKS_v0.3.9.md`
  - `docs/TADOI_QA_Guide_v0.3.9.md`
  - `docs/TADOI_Feature_List_v0.3.9.md`
  - `docs/ops/notion_v0.3.9_sync_pack.md`

### Changed
- App/runtime version surfaces now align to `v0.3.9` / `0.3.9`:
  - `src/app/version.ts`
  - `package.json`
- Active documentation links and baselines were updated to point to the `v0.3.9` artifact set across README/docs indexes, QA/install/usage guides, and Notion staging manifests.
- Historical index coverage was expanded to include `v0.3.8` artifacts now that `v0.3.9` is active.

## [0.3.8] - 2026-02-27
### Added
- Persistence schema baseline moved to `7` with migration `6 -> 7` backfilling
  `workflowStage` (`open -> todo`, `done|archived -> done`).
- Dashboard analytics dimensions and filters were expanded in active v0.3.8 contracts:
  - dimension slices: `assignee`, `project`, `workflowStage`
  - analytics window cycle: `7d|14d|30d`
  - exact due-bucket drill-through via `dueDayOffset` (`+N`)

### Changed
- DTF contract coverage now includes `DTF-008` and `DTF-009` named tests.
- Release governance docs were refreshed to current `v0.3.8` evidence:
  - `docs/RELEASE_RUN_REPORT.md`
  - `docs/RELEASE_NOTES.md`
- Documentation governance sweep aligned active docs, spec sheets, and Notion staging runbooks to current `v0.3.8` implementation.

### Validation
- `bun run docs:lint`: PASS (`[docs-lint] PASS: local markdown links and anchors resolved.`)
- `bun run keybind:canonical:check`: PASS (`canonical=64 missing_in_docs=0 missing_in_code=0`)
- `bun run contract:dtf:check`: PASS (`OK: 9 DTF IDs from DASHBOARD_SPEC_MVP.md, TADOI_SPEC_v0.3.8.md are covered by named test cases in 107 test files.`)
- `bun run notion:sync:validate`: PASS (`[sync] validation OK: items=14`)

## [0.3.7] - 2026-02-25
### Added
- Non-interactive engagement toasts in the bottom bar for completion milestones:
  - first completed task
  - first recurring task created
  - first recurring repeat occurrence completed (not the first series occurrence)
  - 3 completed today
  - 5 completions for a tag in the last 7 days
  - 3-day completion streak
- Persisted engagement state with schema migration `4 -> 5`, completion retention limits,
  and deterministic cooldown/unlock tracking.

### Changed
- Engagement toasts are queued (cap 3), priority ordered, auto-dismissed, and suppressed while
  blocking overlays are open, then resumed after overlays close.
- Persistence schema baseline for this release was `6` with `stateRevision` concurrency hardening.
- Active docs were aligned to the v0.3.7 artifact set:
  - `TADOI_SPEC_v0.3.7.md`
  - `TADOI_TASKS_v0.3.7.md`
  - `docs/TADOI_Feature_List_v0.3.7.md`
  - `docs/TADOI_QA_Guide_v0.3.7.md`
  - `docs/ops/notion_v0.3.7_sync_pack.md`

## [0.3.6] - 2026-02-13
### Changed
- Version surfaces are aligned to `v0.3.6` / `0.3.6` in runtime and active documentation.
- Active release docs now point to the `v0.3.6` artifacts:
  - `TADOI_SPEC_v0.3.6.md`
  - `TADOI_TASKS_v0.3.6.md`
  - `docs/TADOI_Feature_List_v0.3.6.md`
  - `docs/TADOI_QA_Guide_v0.3.6.md`
  - `docs/ops/notion_v0.3.6_sync_pack.md`
- Documentation baselines were refreshed to `v0.3.6` in:
  - `README.md`
  - `docs/README.md`
  - `docs/DOC_INDEX.md`
  - `docs/DOC_AUDIT_REPORT.md`
  - `docs/NOTION_SYNC.md`
  - `docs/TADOI_Installation_Guide_All_Platforms.md`

## [0.3.5] - 2026-02-12
### Added
- Task links / attachments runtime:
  - per-task `links[]` support with optional labels/kind hints
  - details-links focus actions (open/copy/add/edit/delete)
  - add-mode `Ctrl+L` link attach flow
  - unknown-scheme confirmation modal path
- Calendar import foundation and in-app guided flow support:
  - `src/state/calendarImportService.ts`
  - `src/calendar/icsParser.ts`
  - `src/calendar/importMapper.ts`
  - Backup Center calendar import/export guided steps with dry-run-first commit gating
- Security settings surface:
  - `settings.security.nonHttpLinkPolicy` (`prompt|block`)
  - startup path redaction default with verbose override (`TADOI_VERBOSE_PATH_LOGS=1`)
- Versioned release docs for `v0.3.5`:
  - `TADOI_SPEC_v0.3.5.md`
  - `TADOI_TASKS_v0.3.5.md`
  - `docs/TADOI_Feature_List_v0.3.5.md`
  - `docs/TADOI_QA_Guide_v0.3.5.md`
  - `docs/ops/notion_v0.3.5_sync_pack.md`

### Changed
- List-mode routing now supports explicit list/details focus toggle via `Tab` / `Shift+Tab`.
- Link-open policy is source-aware and policy-driven:
  - calendar-imported links default to confirm-on-open behavior
  - non-HTTP and path/file targets can be blocked by `security.nonHttpLinkPolicy=block`
- Calendar export CLI privacy defaults to `--privacy minimal`; `--privacy full` and `--include-details` remain available.
- Windows open-target path now uses argument-based `explorer` spawn with control-character rejection.
- Active docs baselines are aligned to `v0.3.5` / `0.3.5`, including install, QA, feature, spec, and task artifacts.

## [0.3.4] - 2026-02-12
### Added
- New release documentation artifacts:
  - `TADOI_SPEC_v0.3.4.md`
  - `TADOI_TASKS_v0.3.4.md`
  - `docs/TADOI_Feature_List_v0.3.4.md`
  - `docs/TADOI_QA_Guide_v0.3.4.md`
  - `docs/DOC_INDEX.md`
  - `docs/DOC_AUDIT_REPORT.md`
  - `docs/NOTION_SYNC.md`
  - `docs/ops/notion_v0.3.4_sync_pack.md`

### Changed
- Tag panel open key is standardized to `p` in list/dashboard routing and reflected in Help copy.
- Left rail now includes a dedicated `TAG PANEL (P)` menu row and matching hints.
- Brand/logo surface now includes `alternate_blocks32` as a first-class logo mode and in rotating mode order.
- Notion documentation set in `Patrick's Projects > TADOI > Documents` is synchronized to this `v0.3.4` baseline, including spec/task artifacts.
- Active docs baselines are aligned to `v0.3.4` / `0.3.4`:
  - `README.md`
  - `docs/README.md`
  - `TADOI_SPEC_v0.3.4.md`
  - `TADOI_TASKS_v0.3.4.md`
  - `docs/TADOI_Installation_Guide_All_Platforms.md`
  - `docs/TADOI_Feature_List_v0.3.4.md`
  - `docs/TADOI_QA_Guide_v0.3.4.md`
  - `DASHBOARD_SPEC_MVP.md`
  - `TADOI_BackupCenter_InApp_Spec.md`
  - `TADOI_Notifications_Spec_Tier1-2_v0.2.md`
  - `docs/backup-center.md`
  - `docs/recurring-tasks-implementation-plan.md`

## [0.3.0] - 2026-02-11
### Added
- Versioned release documentation artifacts for `v0.3.0`:
  - `TADOI_SPEC_v0.3.0.md`
  - `TADOI_TASKS_v0.3.0.md`
  - `docs/TADOI_QA_Guide_v0.3.0.md`
  - `docs/TADOI_Feature_List_v0.3.0.md`

### Changed
- Version surfaces are aligned to `0.3.0` / `v0.3.0` in runtime and documentation.
- Documentation contracts are synchronized to current behavior:
  - tag filtering now documents legacy cycle (`t`) and boolean panel (`p`, `ALL/ANY/NONE`)
  - search lifecycle copy aligns to `/` open and `Enter`/`Esc` close
  - minimum terminal-size references are normalized to `104x24`
- Dashboard runtime spec now includes boolean tag-filter shape in `Filters` and documents dashboard `p` support.
- Installable distribution spec entrypoint notes now match current split CLI/TUI runtime structure.
- Notion documents in `Patrick’s Projects > TADOI > Documents` were updated in place for the same `v0.3.0` accuracy sync.

## [0.2.9] - 2026-02-11
### Added
- Installable distribution pipeline scaffolding-to-execution upgrade:
  - new CLI router split (`src/cli.ts`) and TUI runner module (`src/tui/runTui.tsx`)
  - headless-safe `--version` and `--smoke-tui` command paths
  - real binary build mode in `scripts/build-binary.ts` via Bun compile
  - packaging scripts for macOS (`pkg` + DMG), Windows (Inno Setup), and Linux (`.deb` + AppImage scaffold)
  - new release workflow (`.github/workflows/release.yml`) for cross-platform build/upload/release
- Linux release target metadata entry in `packaging/release-targets.json`.
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
- Aligned `next7`/`DUE THIS WEEK` semantics across query, recurrence row expansion, and dashboard paths to a consistent rolling 7-day window (`today..+6`).
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
