# Release Readiness Checklist

- Confirm the release scope is defined and unrelated feature work is excluded.
- Confirm the canonical version source is correct before packaging.
- Run the repo or workspace build, check, and test commands required for the release surface.
- Confirm packaging or artifact generation is a clean rebuild, not reuse of stale output.
- Record each gate as `PASS`, `FAIL`, or `BLOCKED` with command evidence.
- Confirm release notes, changelog, and operator docs match the shipped behavior.
- Confirm no debug-only settings or scratch artifacts remain in the release output.
