# TOME (Notes-Oriented Markdown) Feature Verification Report (Slices 1–4)

Date: 2026-03-03
Commit/Branch: 2a702b3 / master
Tester: Codex
OS: Darwin 25.3.0 arm64

## Commands run (exact)

- `bun run typecheck` ✅ (`tsc --noEmit -p tsconfig.typecheck.json` passed)
- `bun run keybind:canonical:check` ✅ (`canonical=65 missing_in_docs=0 missing_in_code=0`)
- `bun test "$PWD/src/notes/frontmatter.test.ts" "$PWD/src/notes/tags.test.ts" "$PWD/src/notes/links.test.ts" "$PWD/src/notes/index.test.ts" "$PWD/src/notes/mentions.test.ts" "$PWD/src/notes/taskRefs.test.ts" "$PWD/src/notes/storage.test.ts" "$PWD/src/notes/service.test.ts" "$PWD/src/notes/index.fixture.test.ts"` ✅ (TOME notes suite pass)
- `bun test "$PWD/src/notes/service.test.ts"` ✅ (includes 100-note incremental edit guard; full reindex count remains stable)
- `bun test "$PWD/src/app/App.bulk.integration.test.ts" "$PWD/src/app/App.modalFlow.integration.test.ts" "$PWD/src/app/App.tits.integration.test.ts"` ✅ (app integration contracts pass)
- `bun test` ❌ (fails in this workspace due `dist/pack-smoke-*` artifact test discovery, unrelated to source changes)
- `bun test "$PWD/src/commands/parse.test.ts" "$PWD/src/commands/execute.test.ts" "$PWD/src/commands/help.test.ts" "$PWD/src/cli/main.test.ts" "$PWD/src/cli/noteCommands.test.ts"` ✅ (`71 pass / 0 fail`)
- `bun test "$PWD/src/notes/links.test.ts" "$PWD/src/notes/index.test.ts" "$PWD/src/notes/service.test.ts" "$PWD/src/notes/commands.test.ts"` ✅ (`20 pass / 0 fail`)
- `bun test "$PWD/src/app/App.modalFlow.integration.test.ts" -t "suppresses engagement toasts while HELP overlay is open"` ✅ (`1 pass / 0 fail`)

## Slice Status Summary

| Slice | Pass/Fail | Evidence                                                                                                       | Fixes made                                                                                                                        |
| ----- | --------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Pass      | TOME storage/service tests + app modal/bulk integration tests pass                                             | Fixed TOME banner race to avoid clobbering in-flight navigation banners during async notes init                                   |
| 2     | Pass      | `tags.test.ts` + fixture vault assertions (`tagToNotes` nested keys) pass                                      | Added deterministic fixture vault with nested inline/frontmatter tags                                                             |
| 3     | Pass      | `links.test.ts`, `index.test.ts`, `index.fixture.test.ts` pass for wikilink/mdlink/backlinks/unlinked mentions | Added ambiguity/id-preference fixture assertions (`[[Duplicate]]` ambiguous vs `[[id:...]]` resolved)                             |
| 4     | Pass      | `taskRefs.test.ts`, `index.fixture.test.ts`, `DetailsPane` integration tests pass                              | Fixed `@task:<id>` parsing to trim trailing punctuation (`@task:task-id.`); added incremental/perf guard tests for 100-note vault |

## Manual QA Evidence (step-by-step)

### Slice 1

1. Verified create/read/write/scan paths in `storage.test.ts` with real temp note files.
2. Verified TOME mode behavior stability through app integration tests (`App.modalFlow.integration`, `App.bulk.integration`).

### Slice 2

1. Verified inline + frontmatter tag parsing and normalization warnings (`tags.test.ts`).
2. Verified nested parent matching and fixture-backed tag index buckets (`index.fixture.test.ts`).

### Slice 3

1. Verified wikilink + markdown link parsing/resolution and backlink computation (`links.test.ts`, `index.test.ts`).
2. Verified unlinked mention detection excludes code fences in fixture vault (`index.fixture.test.ts`).

### Slice 4

1. Verified task ref parsing/derivation with fixture task ID linkage (`taskRefs.test.ts`, `index.fixture.test.ts`).
2. Verified recurrence/modal safety contracts remain green in app integration suites.
3. Verified incremental performance guard (`service.test.ts`) where repeated edits in a 100-note vault do not trigger full reindex.

## Regression Checklist (high severity contracts)

- [x] Esc/Enter behavior unchanged in LIST
- [x] Esc/Enter behavior unchanged in ADD/EDIT
- [x] Modal routing unchanged (delete / overdue / etc.)
- [x] Recurrence semantics unchanged (complete/skip/snooze/delete-series)
- [x] Backup/import gates unchanged

## Re-validation of Deferred Flags (2026-03-03)

- Heading links and block references: `still deferred`.
  - Evidence: [`src/notes/links.ts`](../../src/notes/links.ts) only parses wikilinks/markdown links and does not implement heading/block-ref resolution.
- Persisted on-disk notes index cache: `still deferred`.
  - Evidence: [`src/notes/service.ts`](../../src/notes/service.ts) uses runtime `Map` caches (`cacheByPath`) with no persisted index artifact.
- CLI/TITS notes command layer (Slice 5): `implemented` (this prior flag is stale).
  - Evidence: parser + command execution + CLI runner are present in [`src/commands/parse.ts`](../../src/commands/parse.ts), [`src/notes/commands.ts`](../../src/notes/commands.ts), and [`src/cli/main.ts`](../../src/cli/main.ts), with passing tests listed above.

## Known limitations (explicitly deferred)

- Heading links and block references are not implemented.
- Persisted on-disk notes index cache is deferred (runtime in-memory index only).
- Full markdown fidelity is intentionally out of scope; renderer is pragmatic terminal-focused.
