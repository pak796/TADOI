# TADOI™ Notion Sync Pack (v0.3.8)

Date: `2026-02-27`

## Status

This pack stages Notion updates from repository markdown and is intended for deferred apply.

Target database: `collection://3035aa1e-f93f-80a3-ba35-000b3b596866`  
Parent project: `Patrick's Projects > TADOI`

## Scope

- Canonical source: repository markdown files mapped in `docs/notion/NOTION_SYNC_PAYLOAD.json`.
- Sync mode for this pass: local payload refresh only (no remote Notion write).
- Baseline enforced by this pack:
  - runtime `v0.3.8`
  - package `0.3.8`
  - persistence schema 7

## Mapped Pages (Staged)

| Notion page                                     | Page ID                                | Source file                         |
| ----------------------------------------------- | -------------------------------------- | ----------------------------------- |
| TADOI Installation Guide (All Platforms) v0.3.8 | `3045aa1e-f93f-8191-848a-cbc69ec6e869` | Installation guide (all platforms)  |
| TADOI Install Guide (Concise) v0.3.8            | `3065aa1e-f93f-8188-adb2-c39dc13f90bb` | Installation guide (concise)        |
| TADOI Usage Guide v0.3.8                        | `3065aa1e-f93f-81b5-a6cb-d4d3e64684c0` | `docs/USAGE.md`                     |
| TADOI QA Guide (v0.3.8)                         | `3045aa1e-f93f-8103-bda5-f77d2bf55e8e` | `docs/TADOI_QA_Guide_v0.3.8.md`     |
| TADOI Smoke Test Checklist (v0.3.8)             | `3065aa1e-f93f-81ec-8bd6-cba6cf3876eb` | `docs/QA/SMOKE_TEST_CHECKLIST.md`   |
| TADOI Black Box Test Matrix (v0.3.8)            | `3065aa1e-f93f-8178-af7d-c31a8241854d` | `docs/QA/BLACK_BOX_TEST_MATRIX.md`  |
| TADOI Regression Areas (v0.3.8)                 | `3065aa1e-f93f-8166-998c-d94e5bc16917` | `docs/QA/REGRESSION_AREAS.md`       |
| TADOI Release Checklist (v0.3.8)                | `3065aa1e-f93f-819b-a606-e8337a7ca1d5` | Release checklist                   |
| TADOI Release Notes                             | `3065aa1e-f93f-81ed-9312-f1e427c167da` | Release notes                       |
| TADOI Architecture Overview (v0.3.8)            | `3065aa1e-f93f-8131-b0ed-c9b0dfd1ad0e` | `docs/ARCHITECTURE_OVERVIEW.md`     |
| TADOI User Guide (v0.3.8)                       | `3045aa1e-f93f-810c-82a5-c03e17858168` | `README.md`                         |
| TADOI App Overview + Feature Catalog (v0.3.8)   | `3045aa1e-f93f-81fd-84cd-c93a6b68b49c` | `docs/TADOI_Feature_List_v0.3.8.md` |
| TADOI Product Spec (v0.3.8)                     | `3055aa1e-f93f-812d-ad44-f3d94b8a7219` | `TADOI_SPEC_v0.3.8.md`              |
| TADOI Task List (v0.3.8)                        | `3055aa1e-f93f-8159-b07c-ee692df137eb` | `TADOI_TASKS_v0.3.8.md`             |

## Current Pass Notes

- Docs sweep aligned active docs/spec/task/governance surfaces to current `v0.3.8` implementation.
- Notion payload was refreshed from mapped source markdown (local staging only).
- Staged audit token: `[AUDIT 2026-02-27] Full docs sweep + Notion payload refresh staged for deferred apply`

## Validation Checklist

- `bun run notion:sync:validate` returns PASS.
- `docs/notion/NOTION_SYNC_PAYLOAD.json` markdown matches current source files.
- QA page staged content includes TITS trace set `QA-065`..`QA-072`.
- No remote Notion write is performed until explicitly requested.
