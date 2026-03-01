# Local Markdown TOME QA Checklist (Slices 1-5)

Use this checklist for manual verification of Local Markdown Notes v0.1 (TOME: Terminal Oriented Markdown Environment, a notes-oriented markdown tool).

## Setup
- [ ] Start app with writable data directory.
- [ ] Confirm LIST mode is stable before entering TOME.

## Slice 1: TOME MVP
- [ ] Press `n` from LIST to open TOME list.
- [ ] Press `a`, create note title `Slice1 Note`, confirm `<notesRoot>/Slice1 Note.md` exists.
- [ ] Open note (`Enter`), edit (`e`), add content, save (`Ctrl+S`).
- [ ] Quit/relaunch app; confirm note still exists and content persists.
- [ ] Edit note externally in filesystem; run TOME refresh/reindex (`i`); confirm view updates.
- [ ] Verify no regressions in task list/edit/delete recurring flows.

## Slice 2: Tags + Tag Filter
- [ ] In note body add `#inbox/to-read` and save.
- [ ] Open TOME tag filter (`p`), enter `tag:inbox`, apply.
- [ ] Confirm note with `#inbox/to-read` appears in filtered results.
- [ ] Add a raw tag variant that normalizes differently; confirm warning is visible and non-fatal.
- [ ] Exit TOME and verify task tag filters still behave unchanged.

## Slice 3: Links + Backlinks
- [ ] Create notes `A.md` and `B.md`.
- [ ] In A, add `[[B]]` and save.
- [ ] Open B and confirm A appears in Linked mentions/backlinks.
- [ ] In A add plain text mention `B` without link; confirm B shows unlinked mention from A.
- [ ] Add broken link `[[Missing Note]]`; confirm warning state shows and app does not crash.
- [ ] In TOME view, follow a resolved link with `Enter`; confirm target note opens.

## Slice 4: Task ↔ Note Integration + Root Change
- [ ] Create/select task; add `@task:<task-id>` in a note.
- [ ] Confirm task Details pane shows note under Linked Notes without restart.
- [ ] Open linked note from task details; confirm TOME mode navigation works.
- [ ] Use create-note-from-task action; confirm note is created with task reference.
- [ ] Open TOME root settings (`o`), choose new path, confirm backup + copy-first migration executes.
- [ ] Confirm TOME notes are loaded from new root; old root still exists.
- [ ] Confirm recurrence semantics and recurring-delete modal behavior remain unchanged.

## Reindex and Recovery
- [ ] Run TOME reindex (`i`) after multiple note edits/deletes.
- [ ] Confirm index reflects latest files and backlinks update correctly.
- [ ] If TOME root is invalid/unwritable, confirm app still boots and TOME entry is safely disabled.

## Built-In Guide Docs + Delete/Restore
- [ ] Start with empty notes vault and launch app; confirm exactly four default docs are seeded under `TADOI Guides/`.
- [ ] Restart app without changing notes; confirm defaults are not duplicated.
- [ ] In TOME list, press `d` then `y`; confirm selected note file is deleted and list remains stable.
- [ ] Open a note in TOME view, press `d` then `y`; confirm app returns to TOME list with valid selection.
- [ ] Run `note restore-defaults` after deleting a seeded guide; confirm only missing defaults are recreated.
- [ ] In Help -> Settings, run `Restore TOME Guides`; confirm missing defaults are recreated without overwrite.
- [ ] Run `note restore-defaults` when all defaults exist; confirm no-op output.
- [ ] Run `note delete "<ambiguous>"`; confirm ambiguity handling mirrors `note open`.

## Performance Safety (A8)
- [ ] Copy fixture notes to ~100 files under TOME root (duplicate files with unique names).
- [ ] Open a note in TOME edit mode and type continuously for 10-15 seconds.
- [ ] Confirm UI remains responsive and no full-vault rescan is triggered per keystroke.
- [ ] Save (`Ctrl+S`) and verify incremental update behavior: changed note graph/backlinks update without full reindex.
- [ ] Run `src/notes/service.test.ts` and confirm mtime/hash gating assertions pass.

## Pass/Fail Summary
- [ ] PASS
- [ ] FAIL (record failing step IDs and observed behavior)
