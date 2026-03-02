# Help + Settings Audit Report (2026-03-02)

## Executive Summary
Audit status against requested scope:
- Functionality checks: `PARTIAL PASS`
- UI usability and orientation: `PARTIAL PASS`
- Hint-space / no-wrap behavior: `PARTIAL PASS`
- Navigation consistency (keyboard/mouse): `PASS WITH CAVEATS`
- Strict config parity (all config in Settings modal): `FAIL`
- Docs-versus-runtime alignment: `FAIL`

Primary conclusion:
- The current Help/Settings implementation is operational and tested for core flows.
- The strict parity requirement is not met: multiple persisted configuration fields are outside Help/Settings or not user-configurable.
- Documentation is not fully aligned with runtime defaults and current Settings row inventory.

Companion matrix: `docs/audits/HELP_SETTINGS_CONFIG_PARITY_2026-03-02.md`.

## Investigation Method and Deterministic Evidence
Code paths audited:
- `src/settings/settings.ts`
- `src/state/settingsStore.ts`
- `src/app/App.tsx`
- `src/app/keyRouter.ts`
- `src/app/whichKeyHints.ts`
- `src/components/WhichKeyHintBar.tsx`
- `src/components/WhichKeyPopup.tsx`
- `src/components/LeftRail.tsx`
- `src/state/backupCenterFlow.ts`
- `src/components/BackupCenterScreen.tsx`

Docs audited:
- `TADOI_SPEC_v0.3.9.md`
- `docs/TADOI_Feature_List_v0.3.9.md`
- `docs/TADOI_QA_Guide_v0.3.9.md`
- `docs/KEYBINDS_CANONICAL.md`

Deterministic command runs:
- `bun test '/Users/patrickkazar/Library/CloudStorage/GoogleDrive-pakazar@gmail.com/Other computers/My Computer/Google Drive/CODE PROJECTS/TADOI/src/app/keyRouter.test.ts' --only-failures`
  - Result: `PASS` (`41 pass / 0 fail`)
- `bun test '/Users/patrickkazar/Library/CloudStorage/GoogleDrive-pakazar@gmail.com/Other computers/My Computer/Google Drive/CODE PROJECTS/TADOI/src/app/whichKeyHints.test.ts' '/Users/patrickkazar/Library/CloudStorage/GoogleDrive-pakazar@gmail.com/Other computers/My Computer/Google Drive/CODE PROJECTS/TADOI/src/settings/settings.test.ts' --only-failures`
  - Result: `PASS` (`50 pass / 0 fail`)
- `bun test '/Users/patrickkazar/Library/CloudStorage/GoogleDrive-pakazar@gmail.com/Other computers/My Computer/Google Drive/CODE PROJECTS/TADOI/src/app/App.modalFlow.integration.test.ts' --only-failures`
  - Result: `PASS` (`33 pass / 0 fail`)

Skill audits executed:
- Keybind source-of-truth audit output: `/tmp/tadoi_keybind_audit_2026-03-02.md` (`canonical=71`, `missing_in_docs=0`, `missing_in_code=0`, `semantic_mismatch=0`).

## Checkpoint Results

| Check | Result | Evidence |
|---|---|---|
| Settings coverage matrix built from persisted schema | PASS | `src/settings/settings.ts:74`, matrix file |
| Help/Settings interaction map | PASS | `src/app/App.tsx:492`, `src/app/App.tsx:6625`, `src/app/keyRouter.ts:1099` |
| Functional row action checks | PASS (covered rows) | `src/app/App.modalFlow.integration.test.ts:819`, `src/app/App.modalFlow.integration.test.ts:1123`, `src/app/App.modalFlow.integration.test.ts:755` |
| Hint display mode behavior (`bottom`, `left_rail`, `both`, `none`) | PASS | `src/app/App.modalFlow.integration.test.ts:1123` |
| Prefix popup behavior and independence | PASS | `src/app/App.modalFlow.integration.test.ts:1054`, `src/app/App.modalFlow.integration.test.ts:1167` |
| Keyboard navigation consistency (`Enter/Right`, `Left/Backspace/Esc`) | PASS | `src/app/keyRouter.ts:1118`, `src/app/keyRouter.ts:1125`, `src/app/keyRouter.ts:1128`, `src/app/keyRouter.ts:712`, `src/app/keyRouter.test.ts:1153` |
| Mouse navigation parity in Help and submenu selection | PASS | `src/app/App.tsx:11940`, `src/app/App.tsx:12095` |
| Hint-space no-wrap contracts across all surfaces and all baseline widths | PARTIAL (not fully automated) | width guards in `src/app/renderingComposition.ts:37`, `src/components/WhichKeyHintBar.tsx:13`, `src/components/LeftRail.tsx:49`, missing explicit fit in `src/components/WhichKeyPopup.tsx:23` |
| Strict parity: all persisted config reachable from Settings modal | FAIL | matrix summary + `src/app/App.tsx:492`, `src/components/BackupCenterScreen.tsx:1413`, `src/app/App.tsx:10669` |
| Docs vs runtime drift | FAIL | `TADOI_SPEC_v0.3.9.md:209` vs `src/settings/settings.ts:111`; `docs/TADOI_QA_Guide_v0.3.9.md:178`; `docs/TADOI_Feature_List_v0.3.9.md:104` vs `src/app/App.tsx:492` |

## Severity-Ranked Findings

### F-01 — Sev 1 (Critical)
**Strict Settings parity is not met.**

Impact:
- The requirement "all configurations for every system in the settings modal" is currently unmet.
- Configuration discoverability is fragmented and operator workflows are inconsistent.

Fail criteria:
- Any persisted configuration field not reachable via Help/Settings modal.

Evidence:
- Persisted settings schema includes `security`, `githubBackup`, and `notes` fields: `src/settings/settings.ts:84`, `src/settings/settings.ts:85`, `src/settings/settings.ts:88`, `src/settings/settings.ts:89`.
- Help/Settings nav rows do not include Security, Notes settings, or GitHub config: `src/app/App.tsx:492`.
- Notes root config is in TOME UI (`ROOT[o]`) instead of Settings modal: `src/app/App.tsx:10601`, `src/app/App.tsx:10669`, `src/app/App.tsx:7409`.
- GitHub config is in Backup Center Cloud flow instead of Settings modal: `src/state/backupCenterFlow.ts:43`, `src/components/BackupCenterScreen.tsx:1413`.

Recommendation:
- Implement a single Settings IA that contains all configuration pages; keep operational flows (for example push/restore) outside settings but link from settings.

### F-02 — Sev 2 (High)
**Security policy is persisted and enforced, but not user-configurable in Settings UI.**

Impact:
- Users cannot set `prompt` vs `block` behavior from the UI, despite this being a safety-critical control.

Fail criteria:
- Persisted security setting exists, runtime enforces it, UI has no control.

Evidence:
- Security field: `src/settings/settings.ts:257`.
- Runtime enforcement in link-open flow: `src/app/App.tsx:8304`.
- No `Security` row in Settings nav items: `src/app/App.tsx:492`.

Recommendation:
- Add a `Security` settings subpage with `nonHttpLinkPolicy` control and inline behavior description.

### F-03 — Sev 2 (High)
**Notification timing settings are persisted but not configurable in UI.**

Impact:
- Users can toggle notifications, but cannot tune duration/cooldown parameters without file edits.

Fail criteria:
- Config fields persist/normalize but have no UI control.

Evidence:
- Fields: `src/settings/settings.ts:250`, `src/settings/settings.ts:251`.
- Normalization: `src/settings/settings.ts:574`, `src/settings/settings.ts:578`.
- UI toggles expose only booleans: `src/app/App.tsx:6293`, `src/app/App.tsx:6299`, `src/app/App.tsx:6305`.

Recommendation:
- Add advanced notification controls under Settings -> Notifications.

### F-04 — Sev 2 (High)
**Runtime default for hint display mode conflicts with spec and QA documentation.**

Impact:
- QA expectations and onboarding behavior differ from runtime defaults, causing false failures and confusion.

Fail criteria:
- Documented default differs from runtime default.

Evidence:
- Runtime default: `left_rail` in settings: `src/settings/settings.ts:111`; app/store defaults also resolve to `left_rail`: `src/app/App.tsx:401`, `src/state/settingsStore.ts:77`.
- Spec claims missing/invalid defaults to `bottom`: `TADOI_SPEC_v0.3.9.md:209`.
- QA case expects default `bottom only`: `docs/TADOI_QA_Guide_v0.3.9.md:178`.

Recommendation:
- Choose one authoritative default and align code + spec + QA in a single change.

### F-05 — Sev 2 (High)
**Feature/spec settings row inventories are stale versus runtime.**

Impact:
- Users and QA do not see complete settings surface area in docs.

Fail criteria:
- Documented rows omit active runtime rows.

Evidence:
- Runtime rows include `Keymap Aliases`, `Navigation Hints`, `Prefix Popup`, `Retro FX Mode`, `Restore TOME Guides`: `src/app/App.tsx:492`.
- Feature list row inventory omits several active rows: `docs/TADOI_Feature_List_v0.3.9.md:104`.
- Spec row inventory also omits active rows present in runtime list: `TADOI_SPEC_v0.3.9.md:201`.

Recommendation:
- Regenerate settings row inventory directly from runtime constants and publish to spec/feature/QA docs.

### F-06 — Sev 3 (Medium)
**Settings information architecture is functionally correct but flattened and mixed-domain.**

Impact:
- Discoverability and mental model are weaker than necessary.

Fail criteria:
- Unrelated domains are mixed without grouping/subpages.

Evidence:
- Single flat row list mixes visual themes, keymaps, notifications, and note recovery: `src/app/App.tsx:492`.

Recommendation:
- Group into subpages: `Appearance`, `Navigation & Keymaps`, `Notifications`, `Security`, `Notes`, `Cloud Backup`.

### F-07 — Sev 3 (Medium)
**Help root has one section with different interaction semantics (`Settings & Themes`).**

Impact:
- Inconsistent section behavior can reduce predictability.

Fail criteria:
- A section that usually expands/collapses instead hard-navigates on same gestures without distinct affordance.

Evidence:
- Focused toggle on Settings section opens page instead of toggling section state: `src/app/App.tsx:6561`, `src/app/App.tsx:6573`, `src/app/App.tsx:6592`.

Recommendation:
- Add explicit affordance copy in row title (for example `Open Settings pages`) or make all section headers follow one interaction model.

### F-08 — Sev 3 (Medium)
**Hint-space robustness is uneven: popup lacks explicit no-wrap fit function; left-rail hints silently clip.**

Impact:
- Current content generally fits, but UI is brittle against longer labels/future copy changes.

Fail criteria:
- Hint surfaces without deterministic fit/truncate guards.

Evidence:
- Bottom hint bar has fit+ellipsis: `src/components/WhichKeyHintBar.tsx:13`.
- Help/footer and nav lines use fit-to-width: `src/app/renderingComposition.ts:37`, `src/app/App.tsx:2098`, `src/app/App.tsx:12107`.
- Left rail truncates to width `18` with hard slice (no ellipsis): `src/components/LeftRail.tsx:49`, `src/components/LeftRail.tsx:207`.
- Prefix popup renders raw strings with no fit/truncate contract: `src/components/WhichKeyPopup.tsx:23`.

Recommendation:
- Add shared `fitLineToWidth` behavior for popup and left-rail hints, plus baseline-width snapshot checks.

### F-09 — Sev 4 (Low)
**Help settings status-row capacity is hardcoded.**

Impact:
- Future settings-row edits can desync status rendering expectations.

Fail criteria:
- Static status row count diverges from dynamic status data.

Evidence:
- Constant row count: `src/app/App.tsx:391`.
- Status lines built dynamically from list: `src/app/App.tsx:2773`.

Recommendation:
- Derive count from `helpSettingsStatusLines.length`.

## Recommendation Backlog

| Rollout Order | Recommendation | Severity | User Impact | Engineering Effort | Dependency |
|---|---|---|---|---|---|
| 1 | Define target Settings IA with sections (`Appearance`, `Navigation`, `Notifications`, `Security`, `Notes`, `Cloud`) | Sev 1 | High | Medium | None |
| 2 | Add `Security` settings page and wire `nonHttpLinkPolicy` | Sev 2 | High | Medium | 1 |
| 3 | Add advanced notification timing controls (`bannerDurationMs`, `bellCooldownMs`) | Sev 2 | Medium | Medium | 1 |
| 4 | Add `Notes` settings page (`enabled`, `rootPath`) and keep `ROOT[o]` as shortcut entrypoint | Sev 1 | High | Medium | 1 |
| 5 | Add `Cloud Backup` settings page for `ownerRepo`, `branch`, `autoPushPolicy`; show derived `deviceId/pathPrefix` | Sev 1 | High | Large | 1 |
| 6 | Keep Backup Center for operational tasks (push/restore) but deep-link from Settings page | Sev 1 | High | Medium | 5 |
| 7 | Resolve default hint-mode drift (`bottom` vs `left_rail`) in code/docs/tests as one atomic update | Sev 2 | High | Small | None |
| 8 | Regenerate settings-row docs from runtime constants and update SPEC/Feature/QA references | Sev 2 | Medium | Small | 7 |
| 9 | Add no-wrap/fit tests for baseline widths (`104x24`, `120x30`, `150x44`) covering left rail, `KEYS` bar, Help footer, prefix popup | Sev 3 | Medium | Medium | 1 |
| 10 | Remove hardcoded Help settings status-row count and add regression test | Sev 4 | Low | Small | None |

## Ranked Top-10 Remediation Sequence
1. Lock target Settings IA and ownership boundaries.
2. Migrate Security policy into Settings.
3. Migrate Notification timing controls into Settings.
4. Migrate Notes `enabled/rootPath` into Settings.
5. Add Cloud Backup configuration page in Settings.
6. Deep-link Backup Center operational flows from Settings Cloud page.
7. Align hint default (`bottom` vs `left_rail`) across runtime/spec/QA.
8. Regenerate and republish settings row inventory docs.
9. Add explicit no-wrap baseline tests for all hint surfaces.
10. Derive Help settings status-line count dynamically.

## Evidence Appendix (Finding-to-Source Map)
- `F-01`: `src/settings/settings.ts:74`, `src/app/App.tsx:492`, `src/components/BackupCenterScreen.tsx:1413`, `src/app/App.tsx:10669`.
- `F-02`: `src/settings/settings.ts:257`, `src/app/App.tsx:8304`, `src/app/App.tsx:492`.
- `F-03`: `src/settings/settings.ts:250`, `src/settings/settings.ts:251`, `src/settings/settings.ts:574`, `src/settings/settings.ts:578`, `src/app/App.tsx:6293`.
- `F-04`: `src/settings/settings.ts:111`, `src/app/App.tsx:401`, `src/state/settingsStore.ts:77`, `TADOI_SPEC_v0.3.9.md:209`, `docs/TADOI_QA_Guide_v0.3.9.md:178`.
- `F-05`: `src/app/App.tsx:492`, `docs/TADOI_Feature_List_v0.3.9.md:104`, `TADOI_SPEC_v0.3.9.md:201`.
- `F-06`: `src/app/App.tsx:492`.
- `F-07`: `src/app/App.tsx:6561`, `src/app/App.tsx:6573`, `src/app/App.tsx:6592`.
- `F-08`: `src/components/WhichKeyHintBar.tsx:13`, `src/app/renderingComposition.ts:37`, `src/components/LeftRail.tsx:49`, `src/components/LeftRail.tsx:207`, `src/components/WhichKeyPopup.tsx:23`.
- `F-09`: `src/app/App.tsx:391`, `src/app/App.tsx:2773`.

## Notes on Passed Behavior
- Help subpage keyboard routing consistency is verified: `src/app/keyRouter.test.ts:1153`.
- Help settings row actions and keymap alias immediate effects are verified: `src/app/App.modalFlow.integration.test.ts:819`.
- Hint mode transitions and prefix independence are verified: `src/app/App.modalFlow.integration.test.ts:1123`, `src/app/App.modalFlow.integration.test.ts:1167`.
- Settings persistence round-trip for hint + prefix controls is verified: `src/settings/settings.test.ts:1233`.

