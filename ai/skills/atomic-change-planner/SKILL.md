---
name: atomic-change-planner
description: Convert broad implementation requests into ordered, testable, rollback-safe atomic patch plans. Use when requests are large, ambiguous, or high-risk and need decision-complete execution steps.
---

# Atomic Change Planner

Split big requests into deterministic patch batches with acceptance checks.

## Workflow

1. Read request text from file.
2. Extract discrete objectives.
3. Create at most `--max-patches` atomic patches.
4. For each patch, define:

- goal
- likely file targets
- dependencies
- tests
- rollback note
- acceptance criteria

5. Emit Markdown and JSON plans.

## Command

```bash
python3 "$CODEX_HOME/skills/atomic-change-planner/scripts/atomic_plan.py" \
  --repo-root . \
  --request-file /tmp/request.txt \
  --max-patches 8 \
  --out-md /tmp/atomic_plan.md \
  --out-json /tmp/atomic_plan.json
```

## Planning Rules

- Keep each patch independently testable.
- Avoid mixing unrelated concerns in one patch.
- Place risky migrations late unless needed as blockers.
- Include explicit rollback action for every patch.

## Fallback Behavior

- If request has no obvious structure, split by paragraphs.
- If patch count exceeds limit, merge lowest-risk tasks first.

## References

- Patch sizing rules: `references/patch-sizing.md`
- Acceptance criteria template: `references/acceptance-template.md`
