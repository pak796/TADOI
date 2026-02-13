# TADOI™ Documentation Audit Report

Date: 2026-02-13  
Scope: full documentator sync (local markdown + Notion update-pack generation)  
Baseline: runtime `v0.3.6`, package `0.3.6`

## 1) Summary

This audit re-validated documentation against current code and tests with focus on:
- calendar export/import behavior accuracy
- security and privacy behavior accuracy
- QA/installation/readme contract consistency

Primary outcomes:
- Active docs remain on `v0.3.6` / `0.3.6`.
- Persistence schema references are aligned to `5` for active release docs.
- Calendar docs now accurately state:
  - CLI export is available (`calendar:export`)
  - CLI import is available (`calendar:import`)
  - in-app Backup Center exposes guided calendar export/import flows
- Security/privacy docs now include:
  - `security.nonHttpLinkPolicy` behavior
  - source-aware link confirmation for calendar-imported links
  - startup path redaction default + verbose opt-in flag
- Engagement docs now include non-interactive milestone toast behavior and persisted engagement-state coverage.
- QA guide snapshot and checklist are aligned to current validation:
  - `bun run test`: `555 pass / 0 fail / 555 total`
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
- QA guide calendar section now covers current user-facing in-app flows:
  - export/import flow navigation
  - dry-run-before-commit gating
  - high-impact `IMPORT` confirmation behavior
  - recurrence error/override summary expectations
- README calendar section now reflects CLI export plus Backup Center calendar import/export behavior.
- Feature/spec/task docs now include security policy and privacy controls (`nonHttpLinkPolicy`, redacted startup logs).
- Calendar and security docs now point to current audit/remediation artifacts under `docs/audits/`.
- Automated validation snapshot updated from older counts to current `555/555`.
- Notion update payload is prepared at `docs/ops/notion_v0.3.6_sync_pack.md` for direct MCP page updates in the current session.

### Known intentional boundaries
- Historical versioned docs may include older snapshots by design and are not treated as active release source-of-truth.
- Archival path normalization policy: `docs/ARCHIVAL_PATH_POLICY.md`.

## 4) Files Updated in This Audit Pass

- `README.md`
- `CHANGELOG.md`
- `TADOI_SPEC_v0.3.6.md`
- `TADOI_TASKS_v0.3.6.md`
- `docs/TADOI_Installation_Guide_All_Platforms.md`
- `docs/TADOI_Feature_List_v0.3.6.md`
- `docs/TADOI_QA_Guide_v0.3.6.md`
- `docs/README.md`
- `docs/DOC_INDEX.md`
- `docs/DOC_AUDIT_REPORT.md`
- `docs/NOTION_SYNC.md`
- `docs/ops/notion_v0.3.6_sync_pack.md`

## 5) Validation Commands and Results

- `bun run test` -> `555 pass / 0 fail / 555 total`
- `bun run typecheck` -> pass

## 6) Notion Sync Scope (Documents Database)

Target data source:
- `collection://3035aa1e-f93f-80a3-ba35-000b3b596866`

Pages targeted for update:
- Installation guide: `3045aa1e-f93f-8191-848a-cbc69ec6e869`
- QA guide: `3045aa1e-f93f-8103-bda5-f77d2bf55e8e`
- User guide: `3045aa1e-f93f-810c-82a5-c03e17858168`
- App overview + feature catalog: `3045aa1e-f93f-81fd-84cd-c93a6b68b49c`
- Product spec: `3055aa1e-f93f-812d-ad44-f3d94b8a7219`
- Task list: `3055aa1e-f93f-8159-b07c-ee692df137eb`

Execution note:
- Notion page IDs and source mappings are documented for direct MCP updates in this pass.

## 7) Next Recommended Documentation Work

1. Expose optional top-level `calendar:import` CLI route and command wrapper to complement the existing in-app Backup Center import flow.
2. Add docs link-check/lint workflow for docs-only changes.
3. Generate canonical keybinding table directly from router tests to reduce future drift.

## Trademark Notice
TADOI™ is a trademark of <OWNER>. Other names may be trademarks of their respective owners.
