# TADOI™ Notion Sync Checklist

Date: 2026-02-20
Target workspace area: `Patrick's Projects > TADOI`
Primary documents data source: `collection://3035aa1e-f93f-80a3-ba35-000b3b596866`
Sync status: `Payload ready + notes/token sync pass completed`

## 1) Sync Policy
- Keep Notion guide content aligned to runtime `v0.3.7` and package `0.3.7`.
- Keep first prominent mention per page as `TADOI™`.
- Use repository docs as canonical source for technical behavior contracts.
- Keep TITS coverage aligned to canonical `*TITS*.md` source set.
- Notes/audit token sync pass completed: `[AUDIT 2026-02-20] Metadata+readback synced for TIT v0.3.7`.

## 2) Repo -> Notion Page Mapping

| Repo file | Notion title | Page ID |
|---|---|---|
| `docs/TADOI_Installation_Guide_All_Platforms.md` | `TADOI Installation Guide (All Platforms) v0.3.7` | `3045aa1e-f93f-8191-848a-cbc69ec6e869` |
| `docs/INSTALL.md` | `TADOI Install Guide (Concise) v0.3.7` | `3065aa1e-f93f-8188-adb2-c39dc13f90bb` |
| `docs/USAGE.md` | `TADOI Usage Guide v0.3.7` | `3065aa1e-f93f-81b5-a6cb-d4d3e64684c0` |
| `docs/TADOI_QA_Guide_v0.3.7.md` | `TADOI QA Guide (v0.3.7)` | `3045aa1e-f93f-8103-bda5-f77d2bf55e8e` |
| `docs/QA/SMOKE_TEST_CHECKLIST.md` | `TADOI Smoke Test Checklist (v0.3.7)` | `3065aa1e-f93f-81ec-8bd6-cba6cf3876eb` |
| `docs/QA/BLACK_BOX_TEST_MATRIX.md` | `TADOI Black Box Test Matrix (v0.3.7)` | `3065aa1e-f93f-8178-af7d-c31a8241854d` |
| `docs/QA/REGRESSION_AREAS.md` | `TADOI Regression Areas (v0.3.7)` | `3065aa1e-f93f-8166-998c-d94e5bc16917` |
| `docs/RELEASE_CHECKLIST.md` | `TADOI Release Checklist (v0.3.7)` | `3065aa1e-f93f-819b-a606-e8337a7ca1d5` |
| `docs/RELEASE_NOTES.md` | `TADOI Release Notes` | `3065aa1e-f93f-81ed-9312-f1e427c167da` |
| `docs/ARCHITECTURE_OVERVIEW.md` | `TADOI Architecture Overview (v0.3.7)` | `3065aa1e-f93f-8131-b0ed-c9b0dfd1ad0e` |
| `README.md` | `TADOI User Guide (v0.3.7)` | `3045aa1e-f93f-810c-82a5-c03e17858168` |
| `docs/TADOI_Feature_List_v0.3.7.md` | `TADOI App Overview + Feature Catalog (v0.3.7)` | `3045aa1e-f93f-81fd-84cd-c93a6b68b49c` |
| `TADOI_SPEC_v0.3.7.md` | `TADOI Product Spec (v0.3.7)` | `3055aa1e-f93f-812d-ad44-f3d94b8a7219` |
| `TADOI_TASKS_v0.3.7.md` | `TADOI Task List (v0.3.7)` | `3055aa1e-f93f-8159-b07c-ee692df137eb` |

## 3) TITS Coverage Gates for Sync
- Notion pages must include TITS M1-M3 contract coverage (`add|done|due|recur|help`).
- QA pages must include TITS traceable IDs (`QA-065`..`QA-072`).
- Installation/usage pages must include TITS in-app and CLI quick validation notes.

## 4) Sync Artifacts
- `docs/notion/NOTION_SYNC_PAYLOAD.json`
- `docs/notion/NOTION_SYNC_RUNBOOK.md`
- `docs/notion/NOTION_SYNC_INSTRUCTIONS.md`
- `docs/notion/NOTION_SYNC_VERIFY_2026-02-20.json`

## 5) Execution Note
- This pass is payload/runbook only (no direct Notion write).
- Use `bun run notion:sync:validate` before applying sync via MCP or n8n.

## Trademark Notice
TADOI™ is a trademark of <OWNER>. Other names may be trademarks of their respective owners.
