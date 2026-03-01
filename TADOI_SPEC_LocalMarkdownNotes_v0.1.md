# TADOI Spec: Local Markdown Notes (Obsidian-Inspired, Terminal-Native)
**Spec ID:** TADOI-SPEC-NOTES-LOCALMD  
**Status:** Draft (implementation-ready)  
**Date:** 2026-02-28  
**Audience:** Engineering + Product  
**Scope:** Add a local-first Markdown notes system to TADOI with tags, links/backlinks, and task↔note integration.

---

## 0) Summary
Add a **parallel knowledge layer** to TADOI: **notes as real `.md` files** stored locally (offline-first), plus a **runtime index** for fast search, tags, and backlinks. This follows the core mechanics of Obsidian vaults: notes as Markdown files in a folder, with internal links, tags, and backlink discovery. citeturn0search0turn0search1turn0search2turn0search3

This spec is broken into **4 implementation slices** (low-risk order), each with acceptance criteria and validation commands.

---

## 1) Goals / Non-goals

### Goals
- **Local-first notes**: notes are **plain `.md` files** on disk; external edits are supported.
- **Fast navigation**: title search, full-text search (at least via external search), tag filtering, link traversal.
- **Link graph**: outgoing links + backlinks (linked + unlinked mentions).
- **Consistency with TADOI**:
  - Tasks remain the primary operational object.
  - Notes reuse existing **tag normalization/ranking** behavior.
  - Backlinks are derived from parsing, **not** manually curated.
- **Strict-mode safety**: no key leakage across existing modes; predictable modal semantics.

### Non-goals (for these slices)
- Cloud sync, collaboration, publishing, multi-user permissions.
- Rich Markdown rendering beyond terminal-friendly basics.
- Block references or “true” Obsidian compatibility edge cases (can be later).
- Binary attachments vault management (images/PDF embed), beyond linking to files.

---

## 2) Locked Decisions (non-negotiable)

1) **Identity strategy**
- Use **filename as primary identity**, plus optional `id:` frontmatter for internal disambiguation and future-proofing.
- When conflicts occur, **prefer `id` resolution**, but keep displaying titles.

2) **Link formats**
- Support both:
  - **Wikilinks**: `[[Note Title]]`, `[[Note Title|Alias]]`
  - **Markdown links**: `text -> path/to/note.md`  
Obsidian supports both formats; this keeps portability and user preference. citeturn0search5turn0search1

3) **Markdown rendering approach**
- Implement **pragmatic terminal Markdown** rendering (headings, lists, emphasis, code fences, blockquotes, links).
- Do *not* chase full fidelity; keep readability and performance first.

4) **Storage location**
- Default to TADOI’s existing storage directory:
  - notes live in `<data-dir>/notes/`
- Provide a **settings option** to change notes root path (vault path) later/anytime, with safe migration behavior.

---

## 3) Product UX Model

### Mental model
- **Tasks**: execution and scheduling.
- **Notes**: context, knowledge, planning.
- Users can:
  - write project notes,
  - link notes to tasks,
  - discover related notes via backlinks and tags.

### Primary TUI affordances (terminal-native)
- Notes list (left), preview (center), context pane (right):
  - Tags
  - Outgoing links
  - Backlinks (linked + unlinked mentions)
  - Linked tasks

### Modes (strict routing)
Add new modes; no key leakage into existing modes:

- `Mode.NOTES_LIST` — browse/search notes
- `Mode.NOTES_VIEW` — read-only preview + follow links
- `Mode.NOTES_EDIT` — edit markdown (inline editor)
- `Mode.NOTES_SEARCH` — search UI scoped to notes

(Exact enum naming can match your established conventions; the key is **mode isolation**.)

---

## 4) Storage + File Format

### Default layout
```
<data-dir>/
  data.json               # existing tasks + settings (schema-versioned)
  notes/
    Project Alpha.md
    People/
      Jane Doe.md
  .tadoi/
    notes-index.v1.json   # derived cache (optional), safe to delete/rebuild
    notes-index.lock      # if needed for atomic cache updates
```

Notes folder is configurable via settings (see §7).

### Note file format (Markdown + frontmatter)
**Frontmatter is optional**. If present, it must be valid YAML.

Example:
```yaml
---
id: 9f3c1b7e
title: Project Alpha
tags: [project/alpha, inbox]
created: 2026-02-28T18:05:00-06:00
updated: 2026-02-28T18:05:00-06:00
---
# Project Alpha

Context...

Linked task: @task:abc123
```

Rules:
- `title`:
  - if missing, derive from filename (without extension).
- `id`:
  - optional; if missing, TADOI may compute a stable internal id (hash of canonical path + created timestamp) **but must not rewrite files in slices 1–2**.
- `tags`:
  - optional; tags can also be inline `#tag` in body.

---

## 5) Parsing Rules

### 5.1 Tags
Support:
- Inline tags: `#inbox`, `#project/alpha`
- Frontmatter `tags:` list.

Nested tags use `/`; `tag:inbox` should match `#inbox/*` like Obsidian. citeturn0search2

**Normalization**
- Reuse TADOI tag normalization/ranking.
- Important gotcha: markdown tag text may normalize differently (symbols stripped, length constraints). This must be documented and surfaced (warnings), not treated as errors.

### 5.2 Note links
Support both formats:

**Wikilinks**
- `[[Note Title]]`
- `[[Note Title|Display]]`
- Optional (later): `[[Note#Heading]]`, `[[#Heading]]` (defer until after Slice 3)

**Markdown links**
- `Text -> Relative Path.md` (do not require `%20` input; accept raw spaces when parsing, but canonicalize when generating). citeturn0search5turn0search1

**Resolution strategy**
1. If link target includes an explicit id token format you define (optional future), resolve by id.
2. Else resolve by:
   - exact filename match (case-insensitive optional, depending on OS)
   - then title/frontmatter match
3. If multiple matches exist:
   - prefer `id` matches when available (locked decision)
   - otherwise mark as ambiguous and show a warning UI.

Broken links are **warnings**, not hard failures.

### 5.3 Task links
Add a single, explicit syntax in markdown body:
- `@task:<task-id>` (recommended; avoids collision with note link grammar)

Parsing rule:
- `@task:` + `[A-Za-z0-9_-]+` (match your actual task id format)

---

## 6) Runtime Index (performance keystone)

### Rationale
Backlinks and fast search require a metadata cache / runtime index; Obsidian relies on local file storage plus app-maintained metadata/indexing to make navigation fast. citeturn0search0turn0search3

### Core data structures
```ts
type NoteId = string;
type TaskId = string;

interface Note {
  id?: NoteId;            // from frontmatter
  path: string;           // relative to notes root
  filename: string;       // primary identity
  title: string;
  tags: string[];         // normalized
  created?: string;
  updated?: string;
  mtimeMs: number;        // for incremental indexing
}

interface NoteRef { from: NoteIdOrPath; to: NoteIdOrPath; raw: string; display?: string; }
interface TaskRef { fromNote: NoteIdOrPath; taskId: TaskId; raw: string; }

interface NoteGraphIndex {
  notesByPath: Map<string, Note>;
  notesById: Map<NoteId, Note>;         // sparse
  notesByTitle: Map<string, Note[]>;    // collisions allowed
  tagToNotes: Map<string, Set<string>>; // tag -> note path/id
  outgoingNoteRefs: Map<string, NoteRef[]>;
  outgoingTaskRefs: Map<string, TaskRef[]>;
  backlinks: Map<string, Set<string>>;  // derived: note -> set of referrer notes
}
```

### Index build strategy
- On boot:
  1) scan notes root for `.md`
  2) parse frontmatter + tags + refs
  3) build forward refs
  4) derive backlinks

- Incremental updates:
  - use `mtimeMs` + (optional) content hash
  - reparse only changed files
  - update affected backlinks sets

- Cache persistence (optional):
  - store a derived cache file (e.g., `.tadoi/notes-index.v1.json`)
  - MUST be safe to delete; app can rebuild.
  - Update atomically (write temp + rename) to preserve crash safety.

### Unlinked mentions
Implement a second pass for “unlinked mentions” similar to Obsidian’s backlinks UI: “text that matches the name or alias of another note.” citeturn0search3turn0search6

Constraints:
- Exclude code fences by default (configurable later).
- If multiple notes share a title/alias, mark ambiguity and require user to choose before creating links.

---

## 7) Settings + Migration

### Settings
Add config fields (persisted in schema-versioned JSON):
- `notes.enabled: boolean` (default false or true—product choice)
- `notes.rootPath: string | null`
  - default: `<data-dir>/notes`
  - if user sets it: validate path exists / is writable (or create)

### Changing root path (safe flow)
When user changes `notes.rootPath`:
1. Prompt: **move existing notes?** (copy-first preferred)
2. Always do a pre-change backup consistent with your backup safety invariants.
3. Migration steps:
   - create new folder (if needed)
   - copy notes to new location
   - validate scan count matches
   - switch setting to new root path
   - keep old notes folder unless user explicitly deletes (never auto-delete)

---

## 8) UI / Interaction Design

### Notes List (NOTES_LIST)
- Sort options: last modified, title, most linked (later)
- Search box: substring + fuzzy, plus operators:
  - `tag:<x>` (reuse tag filter semantics)
  - `path:<prefix>` (later)
  - `linked:<note>` / `backlinked:<note>` (later)

### Notes View (NOTES_VIEW)
- Center preview:
  - headings, lists, emphasis, code blocks, blockquotes
  - show links as selectable tokens
- Right pane:
  - Tags
  - Outgoing links
  - Backlinks: Linked mentions + Unlinked mentions (toggle)

Backlinks UI mirrors Obsidian’s split into “Linked mentions” and “Unlinked mentions.” citeturn0search3

### Notes Edit (NOTES_EDIT)
- Text editor with:
  - autosave (debounced) to file
  - conflict-safe write patterns (write temp + rename)
  - preserve external edits by detecting mtime changes; show conflict modal

### Task ↔ Note surfaces
- Task details pane:
  - section: **Linked Notes**
  - derived from `@task:<id>` references in notes + optional explicit attaches in task UI (later)
- Note context pane:
  - section: **Linked Tasks** (parsed `@task:` refs)

---

## 9) Architecture / Integration Constraints (from current TADOI)
- Reducer/state is task-centric; notes must not bloat task objects.
- Persistence is schema-versioned JSON; new settings and any new persisted structures must go through migration + validation.
- Save behavior is debounced and revision-aware; note writes must not bypass conflict safety.

**Approach**
- **Sidecar Markdown Files + Runtime Index** (recommended)  
  - notes as `.md` files next to TADOI data
  - runtime index for tags/refs/backlinks/search

---

## 10) Implementation Slices (4)

> Each slice is shippable. Keep changes small, additive, and mode-safe.

### Slice 1 — Notes MVP (Local files + basic browse/edit)
**Deliverables**
- Notes root folder creation (`<data-dir>/notes`)
- Create/open/edit note file
- Notes list + preview + edit mode (minimal rendering)
- Boot scan and in-memory note list (title + path + mtime)

**Acceptance criteria**
- `note new "X"` (or UI equivalent) creates `<notes-root>/X.md` and opens it
- external editor modification is reflected after save + refresh/reindex
- app remains fully offline

**Validation commands**
- `bun test`
- `bun run lint`
- manual:
  - create note, edit, quit, relaunch; content persists
  - edit file externally; TADOI detects update

---

### Slice 2 — Tags + Tag Filters (reuse TADOI tag behavior)
**Deliverables**
- Parse inline `#tag` + frontmatter `tags:` and normalize via existing tag logic
- Tag filter UI in Notes mode (saved view optional)
- Tag summary widget (count by tag)

**Acceptance criteria**
- Notes with `#inbox/to-read` appear when filtering `tag:inbox` citeturn0search2
- Tag normalization matches tasks’ normalization/ranking behavior
- If a tag normalizes unexpectedly, user sees a warning (non-fatal)

**Validation commands**
- `bun test`
- `rg "#inbox/to-read" <notes-root>` (sanity check)
- manual: filter by `tag:...` and verify nested match behavior

---

### Slice 3 — Links + Backlinks (note graph)
**Deliverables**
- Parse wikilinks + markdown links, build outgoing refs
- Compute backlinks from outgoing refs
- Backlinks UI: “Linked mentions” + “Unlinked mentions” citeturn0search3turn0search6
- Broken link warnings (no crashes)

**Acceptance criteria**
- `[[A]]` in note B produces backlink from A → B when viewing A
- Unlinked mentions lists text matches for note titles/aliases (if aliases supported)
- Ambiguous matches are flagged and do not auto-link without user action

**Validation commands**
- `bun test`
- manual:
  - create two notes; link them; verify backlink
  - create a mention without link; verify unlinked mention appears

---

### Slice 4 — Task ↔ Note Integration
**Deliverables**
- Parse `@task:<task-id>` refs from note bodies
- Task details shows “Linked Notes” (derived)
- Note context shows “Linked Tasks”
- Optional: “Create note from task” command (creates note titled after task)

**Acceptance criteria**
- When a note contains `@task:<id>`, that note appears in task’s Linked Notes
- Following a Linked Note opens the note in NOTES_VIEW
- No changes to recurrence semantics, modal delete semantics, or key routing outside NOTES modes

**Validation commands**
- `bun test`
- manual:
  - add `@task:<id>` to note, verify link surfaces in both directions
  - verify keybinds in LIST/ADD/EDIT unchanged

---

## 11) Risks + Mitigations

### Performance
- Risk: full reindex on every keystroke.
- Mitigation: debounce parsing per-file; incremental updates via mtime/hash; chunk heavy work to avoid TUI frame drops.

### Conflicts / External edits
- Risk: user edits notes in external editor while TADOI edits.
- Mitigation: detect mtime drift; show conflict modal; prefer non-destructive merge strategy (later).

### Tag normalization surprises
- Risk: existing normalization changes tag meaning.
- Mitigation: surface normalization preview; warnings; docs.

---

## 12) Out of scope / Next steps (post-slice ideas)
- Optional cache persistence + fast full-text index (sqlite/fts) for large vaults
- Heading links `[[Note#Heading]]`
- Saved searches / Smart Note Views
- TIT / CLI note commands once runtime stable
- Attachments folder conventions

---

## Appendix A — Obsidian reference behaviors
- Notes are local Markdown files stored in a vault folder; external edits are supported. citeturn0search0
- Supports both Wikilinks and Markdown links. citeturn0search5turn0search1
- Nested tags use `/` and `tag:<parent>` matches nested tags. citeturn0search2
- Backlinks UI distinguishes Linked vs Unlinked mentions. citeturn0search3turn0search6
