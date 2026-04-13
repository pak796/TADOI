# Packaging Confidence CI Expansion Task Breakdown

- Task slug: `packaging-confidence-ci`
- Date: `2026-04-12`

## Atomic changes

| ID  | Goal                                                                                                                                                                       | Allowed files                                                                         | Validation                                                                                                                                                         | Risk   | Rollback                                                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | -------------------------------------------------------- |
| T1  | Replace `package-macos.yml` binary-only packaging smoke with the existing installer gate and installer smoke flow.                                                         | `.github/workflows/package-macos.yml`                                                 | `bun run preflight:host:release && bun run build:installer:mac:all && bun run installer:gate --target macos && bun run installer:smoke --target macos --scope all` | Medium | Revert the workflow step changes in `package-macos.yml`. |
| T2  | Expand `daily-build.yml` host-platform packaging confidence so each matrix job validates its host-built installer outputs instead of only checking for artifact existence. | `.github/workflows/daily-build.yml`                                                   | `bun run preflight:host:release && bun run build:daily && bun run installer:gate --target macos && bun run installer:smoke --target macos --scope all`             | Medium | Revert the workflow step changes in `daily-build.yml`.   |
| T3  | Update task-memory and any operator-facing release checklist text only if the implemented workflow contract changed materially.                                            | `docs/codex/tasks/2026-04-12-packaging-confidence-ci/**`, `docs/RELEASE_CHECKLIST.md` | `bun run preflight:host:docs && bun run docs:lint`                                                                                                                 | Low    | Revert the documentation updates.                        |

## Dependencies

- `T1` should land before any follow-on refactor because it reuses the known-good gate and smoke commands already exercised in `ci.yml` and `release.yml`.
- `T2` depends on the final validation shape chosen in `T1` so both workflows use the same packaging-confidence contract.
- `T3` only applies if `T1` or `T2` change operator-facing validation expectations.

## Done conditions

- The macOS packaging workflow and the daily-build workflow both validate host-built installer artifacts through the shared manifest gate and installer smoke commands.
- No packaging workflow that builds installer outputs is left on binary-only or existence-only checks where stronger artifact validation is already available.
- Local macOS commands pass for the updated packaging-confidence path.
- Task docs record the implemented scope, validation, and remaining risks.
