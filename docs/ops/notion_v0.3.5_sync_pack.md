# TADOI™ Notion Sync Pack (v0.3.5)

Date: `2026-02-13`

## Status
This pack is the canonical payload for direct MCP updates to the listed Notion pages.

Target database: `collection://3035aa1e-f93f-80a3-ba35-000b3b596866`  
Parent project: `Patrick's Projects > TADOI`

## Page 1: Installation Guide
Page ID: `3045aa1e-f93f-8191-848a-cbc69ec6e869`

Property updates:
- `Name`: `TADOI Installation Guide (All Platforms) v0.3.5`
- `date:Date:start`: `2026-02-13`
- `Notes`: `Synced to runtime/package v0.3.5. QA reference updated to v0.3.5 guide and keybinding behavior aligned.`

Replace the top context block with:
```md
# TADOI™ Installation Guide (macOS, Windows, Linux)

This guide covers binary and source installs on macOS, Windows, and Linux.
Runtime baseline: **v0.3.5**.
Manual QA reference: `docs/TADOI_QA_Guide_v0.3.5.md`.
```

## Page 2: QA Guide
Page ID: `3045aa1e-f93f-8103-bda5-f77d2bf55e8e`

Property updates:
- `Name`: `TADOI QA Guide (v0.3.5)`
- `date:Date:start`: `2026-02-13`
- `Notes`: `Synced to v0.3.5 runtime and latest automated snapshot (555/555 pass, typecheck pass). Calendar docs aligned to CLI and Backup Center import/export flows.`

Replace the release baseline section with:
```md
# TADOI™ QA Guide (v0.3.5)

Validation date: **2026-02-13**
Runtime baseline: **v0.3.5**
Package baseline: **0.3.5**
```

Replace the automated snapshot section with:
```md
## Current Automated Validation Snapshot

- `bun run test`: **555 pass / 0 fail / 555 total**
- `bun run typecheck`: **pass**
```

Ensure these checklist cases are present:
```md
- [ ] QA-047 Logo mode cycles through all variants, including blocks.
- [ ] QA-048 Tag panel open behavior parity from list, dashboard, and left rail.
- [ ] QA-049 Task link create/edit/delete flow from details pane.
- [ ] QA-050 Task link open/copy behavior for URL and local path targets.
- [ ] QA-051 External scheme confirmation modal for non-allowlisted URL scheme.
- [ ] QA-052 Calendar export writes valid .ics output.
- [ ] QA-053 In-app calendar export writes .ics with selected range/view/privacy.
- [ ] QA-054 Calendar export privacy behavior (`minimal` vs `full`) is correct.
- [ ] QA-055 Calendar import enforces mandatory dry-run-before-commit.
- [ ] QA-056 Import mode pass-through and high-impact `IMPORT` confirmation.
- [ ] QA-057 RRULE/recurrence import errors block commit with clear guidance.
- [ ] QA-058 RECURRENCE-ID override/cancellation summaries are surfaced.
- [ ] QA-059 Security policy block mode for risky links.
- [ ] QA-060 Startup path redaction/verbose override behavior.
- [ ] QA-061 `calendar:export` + `calendar:import --dry-run` baseline.
- [ ] QA-062 `calendar:import` exit-code semantics.
- [ ] QA-063 Round-trip identity precedence sanity.
- [ ] QA-064 Non-fatal report warning behavior.
```

## Page 3: User Guide
Page ID: `3045aa1e-f93f-810c-82a5-c03e17858168`

Property updates:
- `Name`: `TADOI User Guide (v0.3.5)`
- `date:Date:start`: `2026-02-13`
- `Notes`: `Updated for v0.3.5 behavior: tag panel key standardization, left-rail menu/hints, and logo mode expansion.`

Add/update this release delta block near the top:
```md
## v0.3.5 Behavior Updates

- Tag panel open key is `p` in list and dashboard.
- Left rail includes `TAG PANEL (P)` in menu and hints.
- Logo mode includes `alternate_blocks32` and rotate mode now includes all concrete variants.
- Active docs baseline is now `v0.3.5` (`package.json` `0.3.5`).
```

## Page 4: App Overview + Feature Catalog
Page ID: `3045aa1e-f93f-81fd-84cd-c93a6b68b49c`

Property updates:
- `Name`: `TADOI App Overview + Feature Catalog (v0.3.5)`
- `date:Date:start`: `2026-02-12`
- `Notes`: `Feature catalog synced to v0.3.5 and validated against key router, left rail, brand, and settings surfaces.`

Replace/update feature bullets with:
```md
## Feature Highlights (v0.3.5)

- Keyboard-first task workflow with list, dashboard, add/edit, search, and help modes.
- Tag filtering supports legacy single-tag cycle (`t`) and boolean panel (`p`) with `ALL/ANY/NONE`.
- Search opens with `/` and closes with `Enter` or `Esc`.
- Left rail includes clickable `TAG PANEL (P)` and mode-aware focus surfaces.
- Logo modes: `default`, `alternate32`, `alternate_slash32`, `alternate_blocks32`, `rotating`.
- Minimum terminal size contract: `104x24`.
- Persistence schema baseline: `5` (engagement state included).
- Recurrence-aware list/dashboard behavior with occurrence actions (`Space`, `x`, `z`, `e`, `E`, `d` with `y/f/n`).
- In-app Backup Center and portability flows with dry-run and replace confirmation.
- Task links and attachments workflow (add/edit/open/copy/delete + external scheme confirmation).
- Bottom-bar engagement toasts for milestone completions (non-interactive, queued, auto-dismissed).
- Calendar export CLI supports privacy modes (`minimal` default, `full` optional).
- In-app Backup Center exposes guided calendar import/export flows.
- CLI and in-app import flows are available (`calendar:import` and Backup Center import).
- Security/privacy controls include `security.nonHttpLinkPolicy` and startup path redaction defaults.
```

## Page 5: Product Spec (v0.3.5)
Page ID: `3055aa1e-f93f-812d-ad44-f3d94b8a7219`

Property updates:
- `Name`: `TADOI Product Spec (v0.3.5)`
- `date:Date:start`: `2026-02-13`
- `Notes`: `Created from code-truth audit and linked to active runtime contracts.`

Use this source file:
`TADOI_SPEC_v0.3.5.md`

## Page 6: Task List (v0.3.5)
Page ID: `3055aa1e-f93f-8159-b07c-ee692df137eb`

Property updates:
- `Name`: `TADOI Task List (v0.3.5)`
- `date:Date:start`: `2026-02-13`
- `Notes`: `Created from code-truth audit with completed scope and pending follow-up items.`

Use this source file:
`TADOI_TASKS_v0.3.5.md`

## Validation Checklist After Notion Paste
- Confirm each page title and date property shows `2026-02-13`.
- Confirm all runtime/package references show `v0.3.5` / `0.3.5`.
- Confirm tag panel key is `p` (not Shift+T).
- Confirm QA page includes `QA-047` through `QA-064`.
- Confirm docs clearly state: export/import CLI commands are available and Backup Center import/export flows are available.
- Confirm Product Spec and Task List pages exist at `v0.3.5`.
