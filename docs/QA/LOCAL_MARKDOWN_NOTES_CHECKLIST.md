# Local Markdown Notes QA Checklist (Slices 1-4)

Use this checklist for manual verification of Local Markdown Notes v0.1.

## Setup
- [ ] Start app with writable data directory.
- [ ] Confirm LIST mode is stable before entering notes.

## Slice 1: Notes MVP
- [ ] Press `n` from LIST to open Notes list.
- [ ] Press `a`, create note title `Slice1 Note`, confirm `<notesRoot>/Slice1 Note.md` exists.
- [ ] Open note (`Enter`), edit (`e`), add content, save (`Ctrl+S`).
- [ ] Quit/relaunch app; confirm note still exists and content persists.
- [ ] Edit note externally in filesystem; run notes refresh/reindex (`r`); confirm view updates.
- [ ] Verify no regressions in task list/edit/delete recurring flows.

## Slice 2: Tags + Tag Filter
- [ ] In note body add `#inbox/to-read` and save.
- [ ] Open notes tag filter (`p`), enter `tag:inbox`, apply.
- [ ] Confirm note with `#inbox/to-read` appears in filtered results.
- [ ] Add a raw tag variant that normalizes differently; confirm warning is visible and non-fatal.
- [ ] Exit notes and verify task tag filters still behave unchanged.

## Slice 3: Links + Backlinks
- [ ] Create notes `A.md` and `B.md`.
- [ ] In A, add `[[B]]` and save.
- [ ] Open B and confirm A appears in Linked mentions/backlinks.
- [ ] In A add plain text mention `B` without link; confirm B shows unlinked mention from A.
- [ ] Add broken link `[[Missing Note]]`; confirm warning state shows and app does not crash.
- [ ] In NOTES_VIEW, follow a resolved link with `Enter`; confirm target note opens.

## Slice 4: Task ↔ Note Integration + Root Change
- [ ] Create/select task; add `@task:<task-id>` in a note.
- [ ] Confirm task Details pane shows note under Linked Notes without restart.
- [ ] Open linked note from task details; confirm notes mode navigation works.
- [ ] Use create-note-from-task action; confirm note is created with task reference.
- [ ] Open notes root settings (`o`), choose new path, confirm backup + copy-first migration executes.
- [ ] Confirm notes are loaded from new root; old root still exists.
- [ ] Confirm recurrence semantics and recurring-delete modal behavior remain unchanged.

## Reindex and Recovery
- [ ] Run notes reindex (`r`) after multiple note edits/deletes.
- [ ] Confirm index reflects latest files and backlinks update correctly.
- [ ] If notes root is invalid/unwritable, confirm app still boots and notes entry is safely disabled.

## Performance Safety (A8)
- [ ] Copy fixture notes to ~100 files under notes root (duplicate files with unique names).
- [ ] Open a note in `NOTES_EDIT` and type continuously for 10-15 seconds.
- [ ] Confirm UI remains responsive and no full-vault rescan is triggered per keystroke.
- [ ] Save (`Ctrl+S`) and verify incremental update behavior: changed note graph/backlinks update without full reindex.
- [ ] Run `src/notes/service.test.ts` and confirm mtime/hash gating assertions pass.

## Pass/Fail Summary
- [ ] PASS
- [ ] FAIL (record failing step IDs and observed behavior)
