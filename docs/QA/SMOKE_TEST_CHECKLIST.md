# TADOI™ Smoke Test Checklist

Verified as of 2026-02-13 (v0.3.6).

Run on macOS, Windows, Linux.

## Preconditions
- Terminal >= `104x24`
- Fresh data path override recommended
- Build artifact under test is the current daily build

## Checklist
- [ ] App launches and renders at `>=104x24`
- [ ] Resize below `104x24` shows blocking guard; resizing back resumes
- [ ] `?` opens Help; `Esc` closes
- [ ] `a` opens Add; `Ctrl+S` saves a task; task appears in list
- [ ] `Space` toggles done/open on selected task
- [ ] `/` opens Search; `Enter` or `Esc` exits Search
- [ ] `p` opens boolean tag filter; `Esc` closes
- [ ] `b` toggles Dashboard; `b` returns to list
- [ ] Overdue modal (if triggered) responds to `s` / `d` / `g` / `Esc`
- [ ] Backup Center: `?` -> `1` opens; `Esc` backs out
- [ ] Calendar export: `Export Calendar (.ics)` completes
- [ ] Calendar import: dry-run runs before commit, commit gated
- [ ] Quit: `q` in LIST mode exits cleanly

## Pass Criteria
- All checks pass on all three platforms
- No crash, hang, or stuck modal state
