# TADOI™ Documentation Audit Report

Date: 2026-02-12  
Scope: full documentator sync (local markdown + Notion page alignment)  
Baseline: runtime `v0.3.4`, package `0.3.4`

## 1) Summary

This audit re-validated documentation against current code and tests with focus on:
- calendar export/import behavior accuracy
- security and privacy behavior accuracy
- QA/installation/readme contract consistency

Primary outcomes:
- Active docs remain on `v0.3.4` / `0.3.4`.
- Calendar docs now accurately state:
  - CLI export is available (`calendar:export`)
  - import foundation exists at service level, but `calendar:import` CLI routing is not yet exposed
- Security/privacy docs now include:
  - `security.nonHttpLinkPolicy` behavior
  - source-aware link confirmation for calendar-imported links
  - startup path redaction default + verbose opt-in flag
- QA guide snapshot and checklist are aligned to current validation:
  - `bun run test`: `403 pass / 0 fail / 403 total`
  - `bun run typecheck`: pass

## 2) Code-Truth Verification Sources

Key files used as canonical behavior sources:
- `src/cli.ts`
- `src/cli/calendarCommands.ts`
- `src/commands/calendarExport.ts`
- `src/state/calendarExportService.ts`
- `src/state/calendarImportService.ts`
- `src/calendar/icsParser.ts`
- `src/calendar/importMapper.ts`
- `src/domain/models.ts`
- `src/domain/taskLinks.ts`
- `src/app/openTarget.ts`
- `src/tui/runTui.tsx`
- `src/settings/settings.ts`

## 3) Drift Findings and Resolutions

### Resolved in this pass
- QA guide previously documented `calendar:import` CLI steps that are not reachable from current CLI routing.
  - Replaced with export CLI coverage plus import-foundation verification tied to automated tests.
- README calendar section now reflects export-available/import-foundation status and current privacy defaults.
- Feature/spec/task docs now include security policy and privacy controls (`nonHttpLinkPolicy`, redacted startup logs).
- Calendar and security docs now point to current audit/remediation artifacts under `docs/audits/`.
- Automated validation snapshot updated from older counts to current `403/403`.

### Known intentional boundaries
- Import service implementation exists, but CLI exposure is intentionally pending.
- Historical versioned docs remain unchanged and may include older snapshots by design.

## 4) Files Updated in This Audit Pass

- `README.md`
- `CHANGELOG.md`
- `TADOI_SPEC_v0.3.4.md`
- `TADOI_TASKS_v0.3.4.md`
- `TADOI_Spec_Calendar_Export_ICS_v0.2.md`
- `TADOI_Spec_Calendar_Import_ICS_RoundTrip_v0.1.md`
- `TADOI_Task_Links_Attachments_Spec_v0.2.md`
- `docs/TADOI_Installation_Guide_All_Platforms.md`
- `docs/TADOI_Feature_List_v0.3.4.md`
- `docs/TADOI_QA_Guide_v0.3.4.md`
- `docs/README.md`
- `docs/DOC_INDEX.md`
- `docs/DOC_AUDIT_REPORT.md`
- `docs/NOTION_SYNC.md`
- `docs/ops/notion_v0.3.4_sync_pack.md`

## 5) Validation Commands and Results

- `bun run test` -> `403 pass / 0 fail / 403 total`
- `bun run typecheck` -> pass

## 6) Notion Sync Scope (Documents Database)

Target data source:
- `collection://3035aa1e-f93f-80a3-ba35-000b3b596866`

Pages updated in place:
- Installation guide: `3045aa1e-f93f-8191-848a-cbc69ec6e869`
- QA guide: `3045aa1e-f93f-8103-bda5-f77d2bf55e8e`
- User guide: `3045aa1e-f93f-810c-82a5-c03e17858168`
- App overview + feature catalog: `3045aa1e-f93f-81fd-84cd-c93a6b68b49c`
- Product spec: `3055aa1e-f93f-812d-ad44-f3d94b8a7219`
- Task list: `3055aa1e-f93f-8159-b07c-ee692df137eb`

## 7) Next Recommended Documentation Work

1. Expose `calendar:import` CLI route and command wrapper, then promote import checklist items from engineering verification to full user-facing manual QA.
2. Add docs link-check/lint workflow for docs-only changes.
3. Generate canonical keybinding table directly from router tests to reduce future drift.

## Trademark Notice
TADOI™ is a trademark of <OWNER>. Other names may be trademarks of their respective owners.
