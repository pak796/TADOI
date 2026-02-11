# TADOI QA Guide (v0.3.1)

Validation date: **2026-02-11**
Runtime baseline: **v0.3.1**
Package baseline: **0.3.1**

## 1) Purpose and Scope

This guide defines a robust manual QA process for TADOI across macOS, Windows, and Linux.
It is intended for full regression validation, not only smoke testing.

In scope:
- Launch/layout guard behavior (`104x24` minimum).
- Task lifecycle, keyboard routing, and mode safety.
- Search, legacy tag cycle, boolean tag filtering, and saved views.
- Dashboard parity with list data.
- Recurrence creation, occurrence actions, and delete variants.
- Backup/import/export safety flows.
- Theme/settings persistence, including `custom1` behavior.
- Notification modal behavior and bell cooldown.
- Data safety and corruption recovery.

## 2) Current Automated Validation Snapshot

Local workspace snapshot (captured for transparency):
- `bun run test`: **287 pass / 14 fail / 301 total**.
- `bun run typecheck`: **pass**.

Manual QA is still required and proceeds with known issues documented in Section 8.

## 3) Platform Matrix

| Platform | Terminal baseline | Data path baseline |
|---|---|---|
| macOS | Terminal.app / iTerm2 | `~/Library/Application Support/tadoi/tadoi_data.json` |
| Windows | Windows Terminal | `%APPDATA%\\tadoi\\tadoi_data.json` (fallback `%USERPROFILE%\\AppData\\Roaming\\tadoi\\tadoi_data.json`) |
| Linux | GNOME Terminal | `$XDG_DATA_HOME/tadoi/tadoi_data.json` (fallback `~/.local/share/tadoi/tadoi_data.json`) |

## 4) Environment and Data Isolation Setup

Prerequisites:
1. Bun `>=1.3.9`
2. `bun install`
3. `bun run dev`

Use isolated data files for repeatable QA:
- macOS/Linux: `TADOI_DATA_PATH=/tmp/tadoi_data.qa.json bun run dev`
- Windows PowerShell: `$env:TADOI_DATA_PATH="$env:TEMP\\tadoi_data.qa.json"; bun run dev`

Clear or rotate the override file between major suites to avoid cross-suite contamination.

## 5) Expedited Smoke Runbook

Run these first for a fast confidence pass:
- `QA-001`, `QA-002`, `QA-005`, `QA-008`, `QA-013`, `QA-019`, `QA-023`, `QA-029`, `QA-032`, `QA-036`, `QA-039`, `QA-042`.

Smoke pass criteria:
1. All smoke cases pass on all three platforms.
2. No crash, frozen mode, or unhandled modal state.
3. No P0/P1 defect found in smoke path.

## 6) Full Manual Checklist (Case Catalog)

### A) Launch and Layout

- [ ] `QA-001 [SMOKE]` Launch at `>=104x24` renders expected shell.
  - Preconditions: terminal opened at least `104` columns x `24` rows.
  - Steps: start app with `bun run dev`.
  - Expected: app shell renders normally; no blocking guard.
- [ ] `QA-002 [SMOKE]` Resize below minimum shows blocking guard.
  - Preconditions: app running normally.
  - Steps: resize to `103x24` or narrower.
  - Expected: blocking message shows `Terminal too small (min 104x24)`.
- [ ] `QA-003` Resize back restores interaction without restart.
  - Preconditions: guard currently shown.
  - Steps: resize back to `>=104x24`.
  - Expected: interactive UI resumes immediately.
- [ ] `QA-004` Guard text and help copy match `104x24`.
  - Preconditions: app launched.
  - Steps: verify guard text and Help troubleshooting mention.
  - Expected: all active copy references `104x24`.

### B) Empty-State NUX

- [ ] `QA-005 [SMOKE]` Empty-state NUX opens once on eligible empty dataset.
  - Preconditions: empty data file.
  - Steps: launch app.
  - Expected: welcome/empty NUX modal appears.
- [ ] `QA-006` Empty NUX keyboard actions route correctly (`A`, `Esc`).
  - Preconditions: NUX modal open.
  - Steps: press `A`, relaunch with empty data, press `Esc`.
  - Expected: `A` dismisses + opens Add flow; `Esc` dismisses modal.
- [ ] `QA-007` Empty NUX mouse actions route correctly.
  - Preconditions: NUX modal open.
  - Steps: click Create and Close targets.
  - Expected: controls match keyboard behavior and preserve mode safety.

### C) Core Task Lifecycle

- [ ] `QA-008 [SMOKE]` Add task and save.
  - Preconditions: list mode.
  - Steps: `a`, enter title, `Ctrl+S`.
  - Expected: task is created and visible in list.
- [ ] `QA-009` Edit task fields (title/notes/tags/due/time) and save.
  - Preconditions: existing task selected.
  - Steps: `e`, edit multiple fields, `Ctrl+S`.
  - Expected: values persist after returning to list.
- [ ] `QA-010` Toggle done/open semantics.
  - Preconditions: task selected.
  - Steps: press `Space` twice.
  - Expected: status toggles done then open without selection loss.
- [ ] `QA-011` Duplicate task behavior.
  - Preconditions: task selected.
  - Steps: press `c`.
  - Expected: copy created with expected field duplication semantics.
- [ ] `QA-012` Regular delete modal (`y`, `n`, `Esc`) and context restore.
  - Preconditions: regular task selected.
  - Steps: press `d`, test confirm and cancel paths.
  - Expected: delete and cancel behaviors are correct; mode/focus restore is correct.

### D) Search, Tags, Filters, and Saved Views

- [ ] `QA-013 [SMOKE]` Search open/filter/close with `Enter`.
  - Preconditions: multiple tasks present.
  - Steps: press `/`, type query, press `Enter`.
  - Expected: search closes and filter remains applied.
- [ ] `QA-014` Search close with `Esc` and filter retention.
  - Preconditions: search open with query entered.
  - Steps: press `Esc`.
  - Expected: search closes with consistent filtered state.
- [ ] `QA-015` Legacy tag cycle `t`.
  - Preconditions: open tasks include tags.
  - Steps: press `t` repeatedly.
  - Expected: cycles through open-task tags then clears.
- [ ] `QA-016` Boolean tag panel `Shift+T` controls and bucket edits.
  - Preconditions: tagged tasks present.
  - Steps: open panel, use `Tab`, `1/2/3`, `Enter`, `Ctrl+Enter`, `Esc`.
  - Expected: ALL/ANY/NONE buckets edit and apply correctly.
- [ ] `QA-017` Boolean precedence over legacy tag.
  - Preconditions: both legacy tag state and boolean buckets available.
  - Steps: apply non-empty boolean filter and compare results.
  - Expected: non-empty boolean `tagFilter` overrides legacy `tag`.
- [ ] `QA-018` Saved views create/apply/delete flow.
  - Preconditions: non-default filter state active.
  - Steps: save view, apply via slot `1..9`, delete via `v` overlay.
  - Expected: saved states are restored and removed correctly.

### E) Navigation and Routing Contracts

- [ ] `QA-019 [SMOKE]` Core navigation keys in list mode.
  - Preconditions: list has enough tasks to navigate.
  - Steps: `j/k`, arrows, `gg`, `G`, `Ctrl+U`, `Ctrl+D`, `[` `]`, `{` `}`.
  - Expected: navigation works and remains bounded.
- [ ] `QA-020` No key leakage in text-entry contexts.
  - Preconditions: search/editor/save-view naming contexts.
  - Steps: press list-navigation keys while typing.
  - Expected: list movement does not leak into text-entry modes.
- [ ] `QA-021` Dashboard toggle guard during text entry.
  - Preconditions: text-entry context active.
  - Steps: press `b` and `B`.
  - Expected: dashboard does not toggle while text entry is active.
- [ ] `QA-022` Left-rail focus labels for recurrence editor fields.
  - Preconditions: editor recurrence controls visible.
  - Steps: tab through recurrence fields.
  - Expected: left rail focus labels map to recurrence targets, not fallback labels.

### F) Recurrence and Occurrence Workflows

- [ ] `QA-023 [SMOKE]` Create daily recurrence + preview.
  - Preconditions: add or edit flow with due date present.
  - Steps: configure daily recurrence and view preview.
  - Expected: preview appears and schedule is coherent.
- [ ] `QA-024` Weekly/monthly/custom RRULE creation.
  - Preconditions: recurrence mode enabled.
  - Steps: configure weekly, monthly, then custom RRULE variants.
  - Expected: recurrence definitions save and render correctly.
- [ ] `QA-025` Recurring occurrence actions (`Space`, `x`, `z`).
  - Preconditions: recurring occurrence row visible.
  - Steps: complete/reopen, skip, and snooze occurrence.
  - Expected: actions affect occurrence semantics correctly.
- [ ] `QA-026` Edit occurrence (`e`) vs series (`E`).
  - Preconditions: recurring occurrence selected.
  - Steps: invoke both edit paths.
  - Expected: `e` edits occurrence instance; `E` edits series definition.
- [ ] `QA-027` Recurring delete modal `y` (single occurrence).
  - Preconditions: recurring occurrence selected.
  - Steps: `d`, then `y`.
  - Expected: only selected occurrence removed/exdated.
- [ ] `QA-028` Recurring delete modal `f` (this + future), including first-occurrence edge.
  - Preconditions: recurring occurrence selected.
  - Steps: `d`, then `f`; repeat on first occurrence.
  - Expected: selected and future occurrences truncated; first occurrence can remove series.

### G) Dashboard

- [ ] `QA-029 [SMOKE]` Dashboard KPI strip sanity.
  - Preconditions: mixed open/done/due dataset.
  - Steps: enter dashboard with `b`.
  - Expected: KPI strip shows plausible counts (`OVERDUE`, `TODAY`, `NEXT7`, `OPEN`, `DONE7D`).
- [ ] `QA-030` Top-tags drilldown applies filter.
  - Preconditions: tagged open tasks present.
  - Steps: select top-tags row with arrows and press `Enter`.
  - Expected: active filter updates to selected tag.
- [ ] `QA-031` Dashboard/list filtered dataset parity.
  - Preconditions: non-default filter state applied.
  - Steps: compare dashboard aggregates against visible list scope.
  - Expected: both views are derived from same filtered data.

### H) Backup Center and Portability

- [ ] `QA-032 [SMOKE]` Backup export file creation + collision suffixing.
  - Preconditions: tasks exist.
  - Steps: `?` then `1`, run Export multiple times.
  - Expected: timestamped backups created; collisions use `.1`, `.2`, etc.
- [ ] `QA-033` Import merge flow (dry-run then commit).
  - Preconditions: valid import file ready.
  - Steps: run merge import flow through dry-run and commit.
  - Expected: dry-run summary shown before commit; merge applies correctly.
- [ ] `QA-034` Import replace flow (`REPLACE` gate + pre-import backup).
  - Preconditions: valid import file ready.
  - Steps: run replace mode and type `REPLACE`.
  - Expected: hard confirmation required; pre-import backup created.
- [ ] `QA-035` OS-specific data-path reporting.
  - Preconditions: app running on each OS.
  - Steps: inspect help/data-path display and behavior with overrides.
  - Expected: resolved path matches platform rules.

### I) Notifications and Help Settings

- [ ] `QA-036 [SMOKE]` Overdue modal appears on due transition when enabled.
  - Preconditions: notifications and overdue popup enabled.
  - Steps: create timed task due within 1 minute; wait.
  - Expected: overdue modal appears exactly when task becomes overdue.
- [ ] `QA-037` Overdue modal actions (`S`, `D`, `G`, `Esc`).
  - Preconditions: overdue modal visible.
  - Steps: exercise each modal action.
  - Expected: snooze, done, go-to, and dismiss actions behave as documented.
- [ ] `QA-038` Terminal bell enable/disable and cooldown.
  - Preconditions: overdue event generation available.
  - Steps: toggle bell setting and trigger repeated overdue events.
  - Expected: bell follows enable state and cooldown policy.
- [ ] `QA-039 [SMOKE]` Help toggles persist across restart.
  - Preconditions: app running.
  - Steps: toggle `h/H`, `m/M`, `n/N`, `o/O`, `l/L`; restart app.
  - Expected: setting values persist after restart.

### J) Theme and Custom Theme Behavior

- [ ] `QA-040` Theme rotation includes `custom1` without token regressions.
  - Preconditions: app running.
  - Steps: cycle themes through full order.
  - Expected: `custom1` appears in rotation and renders readable tokens.
- [ ] `QA-041` Custom1 palette/object overrides persist correctly.
  - Preconditions: settings paths writable.
  - Steps: set global/object custom1 values and restart.
  - Expected: customized values normalize and persist.

### K) Data Safety, Recovery, and Mouse UX

- [ ] `QA-042 [SMOKE]` Unwritable data path save-failure banner.
  - Preconditions: force unwritable `TADOI_DATA_PATH`.
  - Steps: attempt task mutation and save.
  - Expected: persistent save error banner shown; app remains usable.
- [ ] `QA-043` Malformed JSON recovery + `.corrupt.<timestamp>` backup.
  - Preconditions: corrupt data JSON file.
  - Steps: relaunch app.
  - Expected: app recovers to safe empty state and writes `.corrupt.*` backup.
- [ ] `QA-044` Startup aging/archive behavior for old done tasks.
  - Preconditions: include done tasks older than retention threshold.
  - Steps: restart app.
  - Expected: archival/aging behavior follows retention policy.
- [ ] `QA-045` Mouse list/rail/editor interactions.
  - Preconditions: mouse support enabled terminal.
  - Steps: click list rows, left rail rows, editor save/cancel.
  - Expected: mouse actions map to expected commands.
- [ ] `QA-046` Mouse actions for overdue modal and info-bar quick filters.
  - Preconditions: overdue modal and tagged filters available.
  - Steps: click modal actions and bottom quick-filter controls.
  - Expected: click interactions match keyboard semantics.

## 7) Automated Coverage Mapping

| Manual area | Primary automated references |
|---|---|
| Layout + size guard | `src/app/layoutGuard.test.ts` |
| Key routing + modal routing | `src/app/keyRouter.test.ts`, `src/app/uiState.test.ts`, `src/ui/state.test.ts` |
| Search/filter/tag precedence | `src/domain/query.test.ts`, `src/domain/tagFilter.test.ts`, `src/domain/savedViews.test.ts` |
| Recurrence engine + draft + delete | `src/domain/recurrence/engine.test.ts`, `src/domain/recurrence/draft.test.ts`, `src/domain/recurrence/delete.test.ts`, `src/domain/taskRows.test.ts` |
| Dashboard KPIs and tags | `src/domain/dashboard.test.ts`, `src/domain/dashboardKpis.test.ts`, `src/domain/tagStats.test.ts` |
| Backup/import/export + portability | `src/state/backupCenterFlow.test.ts`, `src/state/backupService.test.ts`, `src/state/portability.test.ts` |
| Notifications | `src/notifications/notificationManager.test.ts`, `src/notifications/overdueTaskActions.test.ts`, `src/notifications/notifiers/inAppModalNotifier.test.ts`, `src/notifications/notifiers/terminalBellNotifier.test.ts` |
| Settings/theme/custom1 | `src/settings/settings.test.ts`, `src/theme/themes.test.ts`, `src/theme/resolveThemeTokens.test.ts`, `src/theme/custom1ColorUtils.test.ts` |
| Persistence and recovery | `src/state/persistence.test.ts`, `src/state/validation.test.ts` |

## 8) Known Issues in Current Workspace

The following automated failures are currently present and should be tracked during QA runs:

### A) Settings load normalization failures (`src/settings/settings.test.ts`)
- `loadSettings > returns defaults when settings files are missing`
- `loadSettings > reads primary settings file first when valid`
- `loadSettings > uses fallback file when primary is missing`
- `loadSettings > normalizes invalid theme ids to default`
- `loadSettings > defaults flash mode when missing or invalid`
- `loadSettings > normalizes invalid notification settings to defaults`
- `loadSettings > seeds custom1 global palette from active non-rotating theme when missing`
- `loadSettings > seeds custom1 global palette from default when rotating is active`

### B) Settings persistence write-path failures (`src/settings/settings.test.ts`)
- `saveSettingsDebounced > creates parent directories and writes settings`
- `saveSettingsDebounced > coalesces rapid updates and persists only the latest value`
- `saveSettingsDebounced > falls back to ~/.tadoi/settings.json when primary write fails`
- `saveSettingsStrict > writes settings immediately to preferred path`
- `saveSettingsStrict > falls back from primary to fallback path when primary write fails`

### C) Backup/settings integration failure (`src/state/backupService.test.ts`)
- `backupService import/export > imports nested notification settings and writes them to settings.json`

## 9) Evidence and Defect Reporting Template

For each platform run, capture:
- Platform + terminal + version.
- App/package version.
- Case IDs executed.
- Pass/fail/blocked totals.
- Known issue hits (if any).
- New defect reports.

Defect report format:
1. `ID`
2. `Severity` (`P0`, `P1`, `P2`)
3. `Case ID`
4. `Environment` (OS, terminal, data path mode)
5. `Steps to reproduce`
6. `Expected`
7. `Actual`
8. `Artifacts` (screenshots/logs/path)

## 10) Exit Criteria

Release candidate is manual-QA ready when:
1. All smoke cases pass on macOS, Windows, Linux.
2. Full case set (`QA-001` to `QA-046`) is executed at least once per target platform.
3. No open `P0` or `P1` defects remain.
4. Known automated failures are either resolved or explicitly accepted with owner and follow-up.
