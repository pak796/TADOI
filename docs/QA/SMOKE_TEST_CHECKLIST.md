# TADOI™ Smoke Test Checklist

Verified as of 2026-02-20 (v0.3.9).

Run on macOS, Windows, Linux.

## Preconditions
- Terminal >= `104x24`
- Fresh data path override recommended
- Build artifact under test is the current daily build

## Smoke Checklist (Traceable IDs)
- [ ] `QA-001` App launches and renders at `>=104x24`
- [ ] `QA-002` Resize below `104x24` shows blocking guard; resizing back resumes
- [ ] `QA-008` `a` opens Add; `Ctrl+S` saves a task; task appears in list
- [ ] `QA-013` `/` opens Search; `Enter` or `Esc` exits Search
- [ ] `QA-029` `b` toggles Dashboard; `b` returns to list
- [ ] `QA-032` Backup Center opens from Help and returns via `Esc`
- [ ] `QA-052` Calendar submenu opens from Backup Center and supports key navigation
- [ ] `QA-053` Calendar export completes in-app
- [ ] `QA-065` TITS opens with `` ` ``, suppresses list routing while active, and closes with `Esc`
- [ ] `QA-066` TITS `add` succeeds and invalid `at:` without `due:` returns validation error
- [ ] `QA-068` TITS `due` set and clear both succeed for selected task
- [ ] `QA-071` CLI write command returns lock error while app is running

## Pass Criteria
- All checks pass on all three platforms
- No crash, hang, or stuck modal state
- TITS in-app + CLI lock semantics match expected results
