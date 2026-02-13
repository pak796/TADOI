# TADOI™ Notion Sync Checklist

Date: 2026-02-13
Target workspace area: `Patrick's Projects > TADOI`
Primary documents data source: `collection://3035aa1e-f93f-80a3-ba35-000b3b596866`
Sync status: `Pending apply in current MCP session`

## 1) Sync Policy
- Keep Notion guide content aligned to current runtime (`v0.3.6`) and package (`0.3.6`).
- Keep first prominent mention per page as `TADOI™`.
- Use repository docs as the canonical source for technical behavior contracts.

## 2) Target Pages for Sync

### Installation Guide
- Page ID: `3045aa1e-f93f-8191-848a-cbc69ec6e869`
- Title: `TADOI Installation Guide (All Platforms) v0.3.6`
- Source: `docs/TADOI_Installation_Guide_All_Platforms.md`

### QA Guide
- Page ID: `3045aa1e-f93f-8103-bda5-f77d2bf55e8e`
- Title: `TADOI QA Guide (v0.3.6)`
- Source: `docs/TADOI_QA_Guide_v0.3.6.md`

### User Guide
- Page ID: `3045aa1e-f93f-810c-82a5-c03e17858168`
- Title: `TADOI User Guide (v0.3.6)`
- Source: `README.md`

### App Overview + Feature Catalog
- Page ID: `3045aa1e-f93f-81fd-84cd-c93a6b68b49c`
- Title: `TADOI App Overview + Feature Catalog (v0.3.6)`
- Source: `docs/TADOI_Feature_List_v0.3.6.md`

### Product Spec
- Page ID: `3055aa1e-f93f-812d-ad44-f3d94b8a7219`
- Title: `TADOI Product Spec (v0.3.6)`
- Source: `TADOI_SPEC_v0.3.6.md`

### Task List
- Page ID: `3055aa1e-f93f-8159-b07c-ee692df137eb`
- Title: `TADOI Task List (v0.3.6)`
- Source: `TADOI_TASKS_v0.3.6.md`

## 3) Target Property Baseline
For each updated page:
- `Name`: includes `v0.3.6` where applicable.
- `date:Date:start`: `2026-02-13`.
- `Notes`: includes concise provenance to the full documentator sync pass.

## 4) Post-Sync Validation
- Confirm all pages show `v0.3.6` / `0.3.6` consistently.
- Confirm persistence schema references are updated to `5` in active spec/feature content.
- Confirm terminal minimum in all guides is `104x24`.
- Confirm tag panel key is `p` and search close is `Enter/Esc`.
- Confirm recurrence delete copy includes `y` and `f` behavior.
- Confirm calendar docs state:
  - `calendar:export` is user-facing in CLI
  - `calendar:import` is user-facing in CLI
  - in-app Backup Center exposes guided `Import Calendar (.ics)` and `Export Calendar (.ics)` flows
- Confirm security/privacy docs include:
  - `security.nonHttpLinkPolicy` behavior (`prompt|block`)
  - startup path redaction default and verbose override (`TADOI_VERBOSE_PATH_LOGS=1`)
- Confirm feature and QA pages include task links/attachments plus security-policy coverage.
- Confirm feature and spec pages include engagement milestone toast behavior.
- Confirm QA page checklist range is aligned through `QA-064`.

## 5) Execution Note
- Use `docs/ops/notion_v0.3.6_sync_pack.md` as the authoritative copy payload for MCP page updates.

## Trademark Notice
TADOI™ is a trademark of <OWNER>. Other names may be trademarks of their respective owners.
