# Contributing to TADOI™

## Contributions Status

PRs are welcome.
For non-trivial changes, open an issue first so scope and design can be agreed before implementation.

## Contribution Terms

By submitting a contribution (pull request, patch, or other code/docs change), you agree that:

- You retain ownership of your contribution.
- You grant the project owner and downstream maintainers an irrevocable, worldwide, royalty-free, non-exclusive license to use, copy, modify, publish, distribute, sublicense, and relicense your contribution as part of this project and derivative works.
- Your contribution may be included in future releases under the current or future project license terms.

If you do not agree to these terms, do not submit a contribution.

## Dev Setup Quick Start

```bash
bun install
bun run dev
bun run test
bun run test:coverage
bun run typecheck
```

Recommended pre-PR gate:

```bash
bun run release:rc:check
```

## Code Style and Scope

- Keep domain logic pure where possible (`src/domain`).
- Add or update tests for migrations, persistence, and list-selection/filter behavior when those areas change.
- Do not persist UI-only state (mode, focus target, overlay state, scroll offset).
- Keep PRs focused and update docs (`README.md`, `CHANGELOG.md`, `SUPPORT.md`) when behavior or workflow changes.
