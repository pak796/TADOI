# TADOI™ Notion Sync Checklist

Date: 2026-03-04
Target workspace area: `Patrick's Projects > TADOI`
Primary documents data source: `collection://3035aa1e-f93f-80a3-ba35-000b3b596866`
Sync status: `Staged local payload refresh for v0.4.0 (no remote Notion write)`

## 1) Sync Policy
- Keep Notion guide content aligned to runtime `v0.4.0` and package `0.4.0`.
- Keep first prominent mention per page as `TADOI™`.
- Use repository docs as canonical source for technical behavior contracts.
- Keep TITS coverage aligned to canonical `*TITS*.md` source set.
- Notes/audit token staged for this pass: `[AUDIT 2026-03-04] v0.4.0 beta docs/version roll-forward staged (local-only)`.

## 2) Repo -> Notion Page Mapping

| Repo file | Notion title | Page ID |
|---|---|---|
| Installation guide (all platforms) | `TADOI Installation Guide (All Platforms) v0.4.0` | `3045aa1e-f93f-8191-848a-cbc69ec6e869` |
| Installation guide (concise) | `TADOI Install Guide (Concise) v0.4.0` | `3065aa1e-f93f-8188-adb2-c39dc13f90bb` |
| `docs/USAGE.md` | `TADOI Usage Guide v0.4.0` | `3065aa1e-f93f-81b5-a6cb-d4d3e64684c0` |
| `docs/TADOI_QA_Guide_v0.4.0.md` | `TADOI QA Guide (v0.4.0)` | `3045aa1e-f93f-8103-bda5-f77d2bf55e8e` |
| `docs/QA/SMOKE_TEST_CHECKLIST.md` | `TADOI Smoke Test Checklist (v0.4.0)` | `3065aa1e-f93f-81ec-8bd6-cba6cf3876eb` |
| `docs/QA/BLACK_BOX_TEST_MATRIX.md` | `TADOI Black Box Test Matrix (v0.4.0)` | `3065aa1e-f93f-8178-af7d-c31a8241854d` |
| `docs/QA/REGRESSION_AREAS.md` | `TADOI Regression Areas (v0.4.0)` | `3065aa1e-f93f-8166-998c-d94e5bc16917` |
| Release checklist | `TADOI Release Checklist (v0.4.0)` | `3065aa1e-f93f-819b-a606-e8337a7ca1d5` |
| Release notes | `TADOI Release Notes` | `3065aa1e-f93f-81ed-9312-f1e427c167da` |
| `docs/ARCHITECTURE_OVERVIEW.md` | `TADOI Architecture Overview (v0.4.0)` | `3065aa1e-f93f-8131-b0ed-c9b0dfd1ad0e` |
| `README.md` | `TADOI User Guide (v0.4.0)` | `3045aa1e-f93f-810c-82a5-c03e17858168` |
| `docs/TADOI_Feature_List_v0.4.0.md` | `TADOI App Overview + Feature Catalog (v0.4.0)` | `3045aa1e-f93f-81fd-84cd-c93a6b68b49c` |
| `TADOI_SPEC_v0.4.0.md` | `TADOI Product Spec (v0.4.0)` | `3055aa1e-f93f-812d-ad44-f3d94b8a7219` |
| `TADOI_TASKS_v0.4.0.md` | `TADOI Task List (v0.4.0)` | `3055aa1e-f93f-8159-b07c-ee692df137eb` |

## 3) TITS Coverage Gates for Sync
- Notion pages must include TITS M1-M3 contract coverage (`add|done|due|recur|help`).
- QA pages must include TITS traceable IDs (`QA-065`..`QA-072`).
- Installation/usage pages must include TITS in-app and CLI quick validation notes.

## 4) Sync Artifacts
- `docs/notion/NOTION_SYNC_PAYLOAD.json`
- `docs/notion/NOTION_SYNC_RUNBOOK.md`
- `docs/notion/NOTION_SYNC_INSTRUCTIONS.md`
- `docs/notion/NOTION_SYNC_VERIFY_2026-03-04.json`
- `docs/ops/NOTION_DEPLOY_PACKAGE_2026-03-04.md`

## 5) Execution Note
- This pass staged payload + mapping updates locally for all 14 mapped pages.
- No remote Notion write was performed in this pass.
- Deferred apply path:
  - validate payload (`bun run notion:sync:validate`)
  - run MCP apply when explicitly requested
  - read back `Name` / `Date` / `Notes` after remote apply

## Trademark Notice
TADOI™ is a trademark of <OWNER>. Other names may be trademarks of their respective owners.
