# Help + Settings Config Parity Matrix (2026-03-02)

## Scope

Audit target: persisted `TadoiSettings` parity against Help/Settings UX.

Code sources:

- `src/settings/settings.ts`
- `src/app/App.tsx`
- `src/state/settingsStore.ts`
- `src/state/backupCenterFlow.ts`
- `src/components/BackupCenterScreen.tsx`

Classification:

- `Help/Settings UI`: reachable in Help -> Settings pages.
- `Non-Settings UI`: reachable, but outside Help/Settings.
- `Not user-configurable in UI`: persisted field has no direct user control in current UI.
- `System-managed`: persisted runtime metadata, not an end-user setting control.

Strict parity rule for this audit: all configuration controls should be reachable from Help/Settings. Any `Non-Settings UI` or `Not user-configurable in UI` configuration field is treated as a parity gap.

## Matrix

| Setting Path                                                   | Current Surface                                              | Classification              | Evidence                                                                                                                             | Strict Parity Gap   |
| -------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------- |
| `themeId`                                                      | Help -> Settings -> Theme -> Current Theme                   | Help/Settings UI            | `src/settings/settings.ts:75`, `src/app/App.tsx:492`, `src/app/App.tsx:6627`, `src/app/App.tsx:6670`                                 | No                  |
| `logoMode`                                                     | Help -> Settings -> Logo row (preview/commit flow)           | Help/Settings UI            | `src/settings/settings.ts:76`, `src/app/App.tsx:510`, `src/app/App.tsx:5921`, `src/app/App.tsx:6204`                                 | No                  |
| `flashMode`                                                    | Help -> Settings -> Flash Mode                               | Help/Settings UI            | `src/settings/settings.ts:77`, `src/app/App.tsx:514`, `src/app/App.tsx:6643`, `src/app/App.tsx:6261`                                 | No                  |
| `hintDisplayMode`                                              | Help -> Settings -> Navigation Hints                         | Help/Settings UI            | `src/settings/settings.ts:78`, `src/app/App.tsx:502`, `src/app/App.tsx:6634`, `src/app/App.tsx:6237`                                 | No                  |
| `showPrefixHintPopup`                                          | Help -> Settings -> Prefix Popup                             | Help/Settings UI            | `src/settings/settings.ts:79`, `src/app/App.tsx:506`, `src/app/App.tsx:6637`, `src/app/App.tsx:6252`                                 | No                  |
| `crtFxLite`                                                    | Help -> Settings -> CRT FX Lite                              | Help/Settings UI            | `src/settings/settings.ts:80`, `src/app/App.tsx:518`, `src/app/App.tsx:6644`, `src/app/App.tsx:6269`                                 | No                  |
| `crtFxColor`                                                   | Help -> Settings -> CRT FX Profile                           | Help/Settings UI            | `src/settings/settings.ts:81`, `src/app/App.tsx:522`, `src/app/App.tsx:6645`, `src/app/App.tsx:6275`                                 | No                  |
| `crtFxPreset`                                                  | Help -> Settings -> CRT FX Profile                           | Help/Settings UI            | `src/settings/settings.ts:82`, `src/app/App.tsx:522`, `src/app/App.tsx:6645`, `src/app/App.tsx:6275`                                 | No                  |
| `retroFxMode`                                                  | Help -> Settings -> Retro FX Mode                            | Help/Settings UI            | `src/settings/settings.ts:83`, `src/app/App.tsx:526`, `src/app/App.tsx:6646`, `src/app/App.tsx:6287`                                 | No                  |
| `notifications.enabled`                                        | Help -> Settings -> Notifications                            | Help/Settings UI            | `src/settings/settings.ts:247`, `src/app/App.tsx:530`, `src/app/App.tsx:6647`, `src/app/App.tsx:6293`                                | No                  |
| `notifications.inAppOverdueBanner`                             | Help -> Settings -> Overdue Popup                            | Help/Settings UI            | `src/settings/settings.ts:248`, `src/app/App.tsx:534`, `src/app/App.tsx:6650`, `src/app/App.tsx:6299`                                | No                  |
| `notifications.terminalBellOnOverdue`                          | Help -> Settings -> Terminal Bell                            | Help/Settings UI            | `src/settings/settings.ts:249`, `src/app/App.tsx:538`, `src/app/App.tsx:6653`, `src/app/App.tsx:6305`                                | No                  |
| `notifications.bannerDurationMs`                               | No row in Help/Settings; value only persisted/normalized     | Not user-configurable in UI | `src/settings/settings.ts:250`, `src/settings/settings.ts:574`, `src/app/App.tsx:6293`, `src/state/settingsStore.ts:69`              | Yes                 |
| `notifications.bellCooldownMs`                                 | No row in Help/Settings; runtime reads value                 | Not user-configurable in UI | `src/settings/settings.ts:251`, `src/settings/settings.ts:578`, `src/app/notificationRuntime.ts:12`, `src/state/settingsStore.ts:71` | Yes                 |
| `security.nonHttpLinkPolicy`                                   | No Help/Settings row; consumed by link-open policy           | Not user-configurable in UI | `src/settings/settings.ts:257`, `src/settings/settings.ts:585`, `src/app/App.tsx:8304`, `src/app/App.tsx:8305`                       | Yes                 |
| `customThemes.custom1.global` + `customThemes.custom1.objects` | Help -> Settings -> Theme -> Custom1 -> Edit Colors          | Help/Settings UI            | `src/settings/settings.ts:69`, `src/app/App.tsx:554`, `src/app/App.tsx:6671`, `src/app/App.tsx:6677`                                 | No                  |
| `customThemes.textByTheme.*`                                   | Help -> Settings -> Theme -> Text Tuning -> per-theme editor | Help/Settings UI            | `src/settings/settings.ts:71`, `src/app/App.tsx:558`, `src/app/App.tsx:6672`, `src/app/App.tsx:6681`                                 | No                  |
| `keymapAliases.*`                                              | Help -> Settings -> Keymap Aliases page                      | Help/Settings UI            | `src/settings/settings.ts:87`, `src/app/App.tsx:498`, `src/app/App.tsx:6631`, `src/app/App.tsx:6659`                                 | No                  |
| `githubBackup.enabled`                                         | Backup Center -> Cloud / GitHub flows (connect/push)         | Non-Settings UI             | `src/settings/settings.ts:270`, `src/state/backupCenterFlow.ts:43`, `src/app/App.tsx:4391`, `src/app/App.tsx:4543`                   | Yes                 |
| `githubBackup.ownerRepo`                                       | Backup Center -> GitHub connect flow                         | Non-Settings UI             | `src/settings/settings.ts:271`, `src/components/BackupCenterScreen.tsx:1528`, `src/app/App.tsx:4392`                                 | Yes                 |
| `githubBackup.branch`                                          | Set/preserved in runtime; no direct UI edit                  | Not user-configurable in UI | `src/settings/settings.ts:272`, `src/app/App.tsx:4393`, `src/components/BackupCenterScreen.tsx:1413`                                 | Yes                 |
| `githubBackup.deviceId`                                        | Derived/preserved; no direct UI edit                         | Not user-configurable in UI | `src/settings/settings.ts:273`, `src/settings/settings.ts:634`, `src/app/App.tsx:4384`                                               | Yes                 |
| `githubBackup.pathPrefix`                                      | Derived/preserved; no direct UI edit                         | Not user-configurable in UI | `src/settings/settings.ts:274`, `src/settings/settings.ts:639`, `src/app/App.tsx:4385`                                               | Yes                 |
| `githubBackup.autoPushPolicy`                                  | Displayed in GitHub status only                              | Not user-configurable in UI | `src/settings/settings.ts:275`, `src/components/BackupCenterScreen.tsx:1453`, `src/app/App.tsx:4328`                                 | Yes                 |
| `githubBackup.lastPushed.*`                                    | Updated by push pipeline only                                | System-managed              | `src/settings/settings.ts:262`, `src/settings/settings.ts:644`, `src/app/App.tsx:4548`                                               | No (system-managed) |
| `notes.enabled`                                                | Checked at runtime; no toggle UI                             | Not user-configurable in UI | `src/settings/settings.ts:93`, `src/app/App.tsx:6843`, `src/app/App.tsx:6317`                                                        | Yes                 |
| `notes.rootPath`                                               | TOME mode -> ROOT[o] -> TOME ROOT SETTINGS modal             | Non-Settings UI             | `src/settings/settings.ts:94`, `src/app/keyRouter.ts:1487`, `src/app/App.tsx:10669`, `src/app/App.tsx:7409`                          | Yes                 |

## Parity Summary

- Total persisted settings groups audited: `27`
- In Help/Settings UI: `15`
- In non-Settings UI: `3`
- Not user-configurable in UI: `8`
- System-managed metadata: `1`

Strict parity gaps requiring migration into Help/Settings flow:

- `notifications.bannerDurationMs`
- `notifications.bellCooldownMs`
- `security.nonHttpLinkPolicy`
- `githubBackup.enabled`
- `githubBackup.ownerRepo`
- `githubBackup.branch`
- `githubBackup.deviceId`
- `githubBackup.pathPrefix`
- `githubBackup.autoPushPolicy`
- `notes.enabled`
- `notes.rootPath`
