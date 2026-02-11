# TADOI — Task Links / Attachments Spec (MVP+)
Version: v0.2  
Date: February 11, 2026  
Status: Draft / Ready for implementation  
Audience: Codex agent + Solo Dev  

---

## 0. Summary
Add a per-task **Links / Attachments** feature that stores **URLs and filesystem paths** with optional labels, renders them in the **Task Details pane**, and supports fast actions: **Open** and **Copy**. Implementation should be safe (no shell injection), cross-platform, and minimal in UI footprint.

---

## 1. User Stories
1. As a user, I can attach one or more links or file paths to a task so I can find context later.
2. As a user, I can open a link/path from the task details without leaving the app.
3. As a user, I can copy a link/path to paste elsewhere.
4. As a user, I can edit or remove outdated links.

---

## 2. Scope
### In Scope (MVP)
- Task model field: `links[]`
- Add/Edit/Delete links via UI modals
- Details pane section: list and actions
- Cross-platform open:
  - macOS: `open`
  - Linux: `xdg-open`
  - Windows: `start` (via `cmd /c start "" "<target>"`)
- Clipboard copy of the raw target string
- Safe process spawning (no string concatenation shell exec)
- URL scheme allowlist with confirm for unknown schemes

### Out of Scope (MVP)
- Uploading/storing binary files in TADOI
- Link previews (fetching titles, icons)
- File pickers / browsing dialogs
- Validating file existence (optional warning allowed, not required)
- Search indexing on link content
- Sync / cloud storage behaviors

---

## 3. Data Model
### 3.1 Types
```ts
export type TaskLinkKind = "url" | "path";

export type TaskLink = {
  id: string;          // stable unique key
  target: string;      // raw user input: URL or filesystem path
  label?: string;      // optional display name
  kind?: TaskLinkKind; // optional; inferred when omitted
  createdAt?: string;  // optional ISO timestamp
};
```

### 3.2 Task Field
```ts
links?: TaskLink[];
```

### 3.3 Backward Compatibility
- `links` is optional. Missing `links` is treated as an empty list.
- Import/export should preserve `links` if present; tolerate missing fields.

---

## 4. Classification Rules (Auto Type)
When `kind` is absent or user selects **Auto**:
- If `target` parses as a URL **with an explicit scheme** (e.g., `http:`, `https:`, `mailto:`, `file:`), treat as `url`.
- Otherwise treat as `path`.

Notes:
- `file://` is a URL and should remain `url`.
- Windows `C:\...` should classify as `path`.

---

## 5. UX Specification

## 5.1 Details Pane Section
Add a section to Task Details:
- Header: `Links / Attachments (N)`
- Empty state: `No links yet — press A to add`

### Rendering
Each link row shows:
- **Primary**: `label` if provided else a truncated `target`
- **Secondary** (subtle):  
  - URL: host + path (truncated)  
  - Path: basename (truncated)

Truncation:
- Must not break layout; prefer ellipsis.
- If your UI supports it, allow horizontal scroll of the focused row.

## 5.2 Focus & Navigation
- The section participates in the details pane focus order.
- Within the section:
  - `↑/↓` selects previous/next link
  - Selection remains stable across rerenders

## 5.3 Keybindings (MVP)
When Links section is focused:
- `Enter` or `O`: Open selected link/path
- `C`: Copy selected link `target`
- `A`: Add link (modal)
- `E`: Edit selected link (modal)
- `D` or `Backspace`: Delete selected link (confirm modal)
- `Esc`: Close modal / exit section focus (existing app convention)

---

## 6. Add/Edit Modal

### 6.1 Fields
- Label (optional)
- Target (required)
- Type: `Auto | URL | Path` (default Auto)

### 6.2 Validation
- Target must be non-empty.
- If Type = URL:
  - Must parse as URL with a scheme.
  - Optional UX: if user enters `example.com`, show hint: `Try https://example.com`
- If Type = Path:
  - Accept raw input; allow spaces.
  - Do not require existence checks.

### 6.3 Save Behavior
- Add: create a new `TaskLink` with a generated `id`.
- Edit: update the selected `TaskLink` in place (preserve `id`).
- Normalize:
  - Trim surrounding whitespace from `label` and `target`.
  - Do **not** rewrite paths/URLs (no aggressive normalization in MVP).

---

## 7. Delete Confirm Modal
- Title: `Remove link?`
- Body: show label/target snippet
- Actions: `Yes` / `No`
- Default: `No` (safer)

---

## 8. Open / Copy Implementation

## 8.1 Clipboard Copy
- Copies the raw `target` string as plain text.
- On failure: show non-blocking notification `Copy failed`.

## 8.2 Open (Cross-Platform)
### Preferred (recommended)
Use a well-maintained cross-platform open helper library so quoting/escaping is handled correctly.

### If implementing OS commands directly
- macOS: spawn `open` with `[target]`
- Linux: spawn `xdg-open` with `[target]`
- Windows: spawn `cmd` with `["/c", "start", "", target]`
  - Ensure quoting behavior is correct and avoid `shell: true` unless strictly required.

Open behavior:
- Non-blocking (do not wait for child process).
- On failure: show non-blocking notification `Could not open link`.

---

## 9. Security Requirements

## 9.1 Avoid Command Injection
- Do **not** concatenate user input into shell strings.
- Use spawn/execFile with argument arrays.

## 9.2 URL Scheme Allowlist
Allow by default:
- `http`, `https`, `mailto`, `file`

For other schemes:
- Show confirm modal: `Open external scheme "<scheme>"?`
- Default selection: `No`

Rationale:
- Prevent accidental opening of custom handlers that may trigger unintended apps/actions.

---

## 10. Error Handling & Notifications
- Open failure: `Could not open link.`
- Copy failure: `Copy failed.`
- Validation failure in modal: inline message under the field; do not close modal.

---

## 11. QA / Test Plan

### 11.1 Unit Tests
- Kind inference:
  - `https://x` => url
  - `mailto:test@x.com` => url
  - `/Users/a b/file.txt` => path
  - `C:\A B\file.txt` => path
- Allowlist confirmation:
  - `vscode://...` triggers confirm
- Reducer/store updates:
  - add/edit/delete links preserves other task fields

### 11.2 Integration Smoke Tests
- Add link persists across restart.
- Edit updates the correct item (id stable).
- Delete removes correct item.
- Copy copies exact target.
- Open calls platform wrapper (mock spawn).

### 11.3 UX Checks
- Empty state renders correctly.
- Long strings truncate without clipping.
- Keyboard navigation does not trap focus.

---

## 12. Acceptance Criteria (Definition of Done)
- Tasks can store `links[]` with multiple entries.
- Details pane shows the section and correct count.
- Users can Add/Edit/Delete via keyboard.
- Copy works.
- Open works on macOS/Linux/Windows.
- Unknown URL schemes require confirm.
- No naive shell exec string concatenation.

---

## 13. Future Enhancements (Not in MVP)
- “Open containing folder” for paths
- Reorder links (move up/down)
- Paste-to-add workflow
- Global search/filter by link label/target
- Inline quick-add command (`+link <target>`)
