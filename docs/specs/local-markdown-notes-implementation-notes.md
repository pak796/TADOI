# Local Markdown Notes v0.1 Implementation Notes

## Scope
This document captures implemented integration points for Local Markdown Notes slices 1-4 plus slice 5 B6/B7 command-parser/help constraints in TADOI (`v0.3.9` baseline).
The user-facing product name for this feature is TOME (Terminal Oriented Markdown Environment), a notes-oriented markdown tool.

## Boot and Load Integration
- TOME settings are loaded from the existing settings pipeline:
  - `src/settings/settings.ts`: adds `notes.enabled` and `notes.rootPath` normalization/defaults.
  - `src/state/settingsStore.ts`: extends runtime settings reducer/state with `notes`.
- App boot initializes TOME runtime in:
  - `src/app/App.tsx`: notes service init + periodic changed-file refresh.
  - `src/tui/runTui.tsx`: passes initial notes settings into App.
- Default guide seed behavior:
  - app boot calls `seedDefaultGuideDocsIfEmpty()` after init
  - seed runs once for empty vaults and writes guides under `TADOI Guides/`
  - startup seed never overwrites user notes
  - deleted defaults are recovered only via explicit `note restore-defaults`
- TOME root resolution:
  - Default root: `<data-dir>/notes` (from `getDataFilePath()` parent).
  - Custom relative root resolves against `<data-dir>`.
  - Implementation: `src/notes/storage.ts` (`resolveNotesRootPath`).
- Graceful degradation:
  - If TOME root init fails, TOME runtime is disabled and error state is retained.
  - App boot still proceeds; opening TOME surfaces the disabled/error message.

## Settings and Safe Root Migration
- Settings fields:
  - `notes.enabled: boolean` (default `true`)
  - `notes.rootPath: string | null` (default `null` => default root)
- TOME root change flow (TOME mode):
  - open root modal (`o`) in TOME list
  - validate path
  - create pre-change backup via `createDataBackup(getDataFilePath())`
  - copy-first migration to new root (old root not deleted)
  - reindex from new root
  - persist settings update
- Backup import/export settings round-trip updated in:
  - `src/state/backupService.ts`

## TOME Runtime and Reindex
- Runtime modules: `src/notes/*`
  - `storage.ts`: scan/load/create/save, atomic writes (`tmp + rename`) with per-path queue
  - `frontmatter.ts`: frontmatter parser (`id/title/tags/created/updated/aliases`)
  - `tags.ts`: inline + frontmatter tag extraction, nested tag expansion, normalization warnings
  - `links.ts`: wikilink + markdown link parsing/resolution
  - `taskRefs.ts`: `@task:<id>` extraction
  - `mentions.ts`: unlinked mention detection
  - `index.ts`: in-memory incremental graph index and derived backlinks
  - `service.ts`: app-facing orchestration API
- Reindex strategy:
  - startup full scan of `.md` notes
  - periodic incremental refresh by `mtime`
  - hash gating avoids reparsing when file timestamps change but content hash is unchanged
  - explicit `Reindex TOME` command (`r`) performs full rebuild
  - instrumentation is available via `NotesService.getInstrumentation()` for dev/test guardrails

## UI and Mode Isolation
- Added modes in `src/ui/modeFocus.ts`:
  - `NOTES_LIST`, `NOTES_VIEW`, `NOTES_EDIT`, `NOTES_SEARCH`, `NOTES_TAG_FILTER`
- Added TOME routing in `src/app/keyRouter.ts` with isolated branches and no key leakage into existing task modes.
- Entry hotkey:
  - `n` from LIST and DASHBOARD opens TOME.
- Help/Settings includes a recovery action:
  - `Restore TOME Guides` recreates missing built-in guide notes from the settings page.
- Delete note hotkey:
  - `d` in `NOTES_LIST` and `NOTES_VIEW` opens note delete confirm modal
  - modal confirm/cancel contract: `y` confirm, `n`/`Esc` cancel

## Slice QA Mapping
- Slice 1 (MVP):
  - create/open/edit/save markdown notes under resolved root
  - relaunch persistence
  - external edits visible after refresh/reindex
- Slice 2 (tags):
  - parses frontmatter + inline tags
  - uses existing tag normalization behavior
  - supports TOME tag filter mode with nested tag matching
- Slice 3 (links/backlinks):
  - parses wikilinks + markdown links
  - resolves note refs and computes backlinks derived from outgoing refs
  - surfaces linked and unlinked mentions
- Slice 4 (task integration + root change):
  - parses `@task:<id>`
  - task details show linked TOME notes
  - TOME context shows linked tasks
  - task->note navigation and create-note-from-task path
  - safe root migration flow implemented

## Deterministic Fixture Vault
- Shared fixture vault path:
  - `test/fixtures/notes_vault_basic/notes`
- Fixture coverage includes:
  - wikilinks, markdown links, nested tags, task refs
  - ambiguous same-title notes and id-based disambiguation target
- Integration-ish assertions are in:
  - `src/notes/index.fixture.test.ts`

## Slice 5 Command Layer Baseline (B6/B7)
- Shared parser/execution path now supports TOME commands:
  - parser: `src/commands/parse.ts` (`note q|quick|capture`, `nq`, `note new --template`, `note template`, `note search|query`, `note graph|links`, plus existing `open/delete/restore-defaults/reindex/help/root set`)
  - shared note execution: `src/notes/commands.ts`
  - CLI bridge: `src/cli/noteCommands.ts` + `src/cli/main.ts`
  - in-app TITS bridge: `src/app/App.tsx` command bar branch
- TIT and CLI both call the same TOME command executor (`executeNoteCommand`) for:
  - quick capture with structured metadata/frontmatter (`capture.source`, `capture.timestamp`, `status`, `aliases`, custom `--meta:*`)
  - quick capture stdin parity (`printf "body" | tadoi note q "Title"`)
  - create note
  - template-backed note creation (`note new --template`, `note template`)
  - open note
  - search/query TOME notes with composable filters (`tag:`, `-tag:`, `title:`, `path:`, `text:`, `created:`, `updated:`, `limit:`, `format:`)
  - graph/link discoverability (`note graph`, `note links` with incoming/outgoing/both)
  - delete note (shared open-query resolver)
  - restore default guide docs (missing-only, non-destructive)
  - reindex TOME notes
- Root change command safety:
  - `note root set <path>` runs pre-change backup + copy-first migration + settings persistence.
  - old TOME root is not deleted automatically.
- Minimal help copy added in docs and command help (`help note` / `note help`) with the required command shape.

## Known Deferred Items
- Heading/block-level links and block references
- Persisted on-disk TOME index cache
- Full markdown renderer fidelity beyond pragmatic terminal formatting
