# Safe Scope And Atomic Change Checklist

- State the task scope, allowed files, do-not-touch paths, validation, and dataset impact before editing.
- Run `safe-scope-enforcer` before edits for constrained tasks.
- Split broad work into atomic patches with explicit acceptance checks.
- Keep each patch independently reviewable and rollback-safe.
- Re-run `safe-scope-enforcer` after edits.
- Confirm no unrelated files changed before finalizing.
