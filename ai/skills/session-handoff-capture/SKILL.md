---
name: session-handoff-capture
description: Generate structured end-of-session handoff documents with decisions, changed files, blockers, and reproducible next steps. Use when transferring work between agents or humans, or pausing implementation mid-stream.
---

# Session Handoff Capture

Produce decision-complete handoff notes that another engineer can execute immediately.

## Workflow

1. Capture context title and output path.
2. Include git status and recent commit history.
3. Summarize what changed, what is blocked, and what remains.
4. Emit actionable next commands.
5. Store as Markdown artifact.

## Command

```bash
python3 "$CODEX_HOME/skills/session-handoff-capture/scripts/handoff_capture.py" \
  --repo-root . \
  --title "Release prep handoff" \
  --out-md /tmp/session_handoff.md \
  --include-git-log 15 \
  --include-status
```

## Required Output Sections

- Session summary
- Decisions captured
- Current workspace state
- Completed items
- Risks and blockers
- Recommended next commands

## Fallback Behavior

- If git is unavailable, emit handoff with explicit warning section.
- If repository has no commits, keep log section empty and continue.

## References

- Base handoff template: `references/handoff-template.md`
- Risk severity rubric: `references/risk-severity.md`
