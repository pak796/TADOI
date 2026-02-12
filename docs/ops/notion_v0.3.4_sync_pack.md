# TADOI™ Notion Sync Pack (v0.3.4)

Date: `2026-02-12`

## Status
Direct Notion MCP writes are currently blocked in this environment due auth refresh failure (`invalid_grant` on MCP initialize).  
Use this pack to apply the same `v0.3.4` updates manually in Notion.

Target database: `collection://3035aa1e-f93f-80a3-ba35-000b3b596866`  
Parent project: `Patrick's Projects > TADOI`

## Page 1: Installation Guide
Page ID: `3045aa1e-f93f-8191-848a-cbc69ec6e869`

Property updates:
- `Name`: `TADOI Installation Guide (All Platforms) v0.3.4`
- `date:Date:start`: `2026-02-12`
- `Notes`: `Synced to runtime/package v0.3.4. QA reference updated to v0.3.4 guide and keybinding behavior aligned.`

Replace the top context block with:
```md
# TADOI™ Installation Guide (macOS, Windows, Linux)

This guide covers binary and source installs on macOS, Windows, and Linux.
Runtime baseline: **v0.3.4**.
Manual QA reference: `docs/TADOI_QA_Guide_v0.3.4.md`.
```

## Page 2: QA Guide
Page ID: `3045aa1e-f93f-8103-bda5-f77d2bf55e8e`

Property updates:
- `Name`: `TADOI QA Guide (v0.3.4)`
- `date:Date:start`: `2026-02-12`
- `Notes`: `Synced to v0.3.4 runtime and latest automated snapshot (342/342 pass, typecheck pass).`

Replace the release baseline section with:
```md
# TADOI™ QA Guide (v0.3.4)

Validation date: **2026-02-12**
Runtime baseline: **v0.3.4**
Package baseline: **0.3.4**
```

Replace the automated snapshot section with:
```md
## Current Automated Validation Snapshot

- `bun run test`: **342 pass / 0 fail / 342 total**
- `bun run typecheck`: **pass**
```

Add these checklist cases under Data Safety/Mouse:
```md
- [ ] QA-047 Logo mode cycles through all variants, including blocks.
- [ ] QA-048 Tag panel open behavior parity from list, dashboard, and left rail.
```

## Page 3: User Guide
Page ID: `3045aa1e-f93f-810c-82a5-c03e17858168`

Property updates:
- `Name`: `TADOI User Guide (v0.3.4)`
- `date:Date:start`: `2026-02-12`
- `Notes`: `Updated for v0.3.4 behavior: tag panel key standardization, left-rail menu/hints, and logo mode expansion.`

Add/update this release delta block near the top:
```md
## v0.3.4 Behavior Updates

- Tag panel open key is `p` in list and dashboard.
- Left rail includes `TAG PANEL (P)` in menu and hints.
- Logo mode includes `alternate_blocks32` and rotate mode now includes all concrete variants.
- Active docs baseline is now `v0.3.4` (`package.json` `0.3.4`).
```

## Page 4: App Overview + Feature Catalog
Page ID: `3045aa1e-f93f-81fd-84cd-c93a6b68b49c`

Property updates:
- `Name`: `TADOI App Overview + Feature Catalog (v0.3.4)`
- `date:Date:start`: `2026-02-12`
- `Notes`: `Feature catalog synced to v0.3.4 and validated against key router, left rail, brand, and settings surfaces.`

Replace/update feature bullets with:
```md
## Feature Highlights (v0.3.4)

- Keyboard-first task workflow with list, dashboard, add/edit, search, and help modes.
- Tag filtering supports legacy single-tag cycle (`t`) and boolean panel (`p`) with `ALL/ANY/NONE`.
- Search opens with `/` and closes with `Enter` or `Esc`.
- Left rail includes clickable `TAG PANEL (P)` and mode-aware focus surfaces.
- Logo modes: `default`, `alternate32`, `alternate_slash32`, `alternate_blocks32`, `rotating`.
- Minimum terminal size contract: `104x24`.
- Recurrence-aware list/dashboard behavior with occurrence actions (`Space`, `x`, `z`, `e`, `E`, `d` with `y/f/n`).
- In-app Backup Center and portability flows with dry-run and replace confirmation.
```

## Validation Checklist After Notion Paste
- Confirm each page title and date property shows `2026-02-12`.
- Confirm all runtime/package references show `v0.3.4` / `0.3.4`.
- Confirm tag panel key is `p` (not `Shift+T`).
- Confirm QA page includes `QA-047` and `QA-048`.
