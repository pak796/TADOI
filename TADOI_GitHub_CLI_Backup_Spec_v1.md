# TADOI Optional Feature Spec — GitHub CLI Cloud Backup (Personal Repo, Push + Restore)
**Spec ID:** TADOI-GH-BACKUP-v1  
**Status:** Implemented baseline (v0.3.9)  
**Last updated:** 2026-03-03  
**Scope:** Optional feature surfaced in **Backup Center**. Uses **GitHub CLI (`gh`)** auth (user-managed) to push restore-grade backups to a **personal private GitHub repo**.  
**Out of scope (v1):** org repos, realtime multi-device sync, conflict-free continuous sync, ICS as canonical restore.

---

## 0) Context & constraints (from current TADOI behavior)
- **Local-first**. Canonical restore path is **JSON** (not ICS).
- Runtime data: `tadoi_data.json` (OS-resolved path; overridable by `TADOI_DATA_PATH`).
- Settings: `settings.json` with normalization fallbacks.
- Backup Center export: writes timestamped JSON files in a sibling `backups/` folder.
- JSON import: supports **merge** and **replace**, supports **dry-run**, and commit creates a **pre-import snapshot** by default (`tadoi_data.json.backup.YYYYMMDD-HHMMSS`).
- Writes are lock-protected, atomic, and guarded by optimistic `stateRevision` conflict checks.
- Treat timestamped JSON exports (non-redacted) + settings snapshots as **restore-grade** artifacts.
- Exclude lock/temp/runtime artifacts from cloud snapshots.

---

## 1) Goals
### G1 — “User-owned GitHub backup” without TADOI-managed credentials
- Use GitHub CLI’s existing auth (`gh auth login`) so TADOI does **not** store tokens in `settings.json`.
- TADOI stores only non-secret remote config: `owner/repo`, `branch`, `pathPrefix`, `deviceId`, policy flags.

### G2 — Push backups (restore-grade snapshots)
- Push **timestamped** backups (state + settings + manifest) to a personal repo.
- Maintain a **`latest/` pointer** for convenience restores.

### G3 — Restore onto a new machine
- Pull snapshot list (from repo), download selected snapshot, then run existing:
  - JSON import **dry-run → commit** gates (no bypasses)
  - pre-import snapshot creation and atomic/locked write path

### G4 — Optional auto-push policies (conservative)
- Support **auto-commit+push** without user needing to run manual git commands.
- Default is **manual push**; auto-push must be opt-in and coalesced (debounced).

---

## 2) Non-goals (v1)
- Org repos or org policy UX (approvals, PAT lifetime constraints).
- Full multi-device sync (continuous merges, CRDT/event-log).
- Encrypt-before-upload (optional future; not required for v1).
- Uploading ICS as canonical restore (ICS remains interoperability-grade/possibly lossy).

---

## 3) User stories
1. **Setup**: As a user, I want to connect TADOI to my personal GitHub repo using my existing `gh` login.
2. **Push**: As a user, I want to push a restore-grade backup snapshot to GitHub from Backup Center.
3. **Restore**: As a user on a new machine, I want to connect to my repo, pick a snapshot, and restore via TADOI’s existing import safety gates.
4. **Auto-push**: As a user, I want the option to automatically push backups without manually initiating each push, with minimal noise and safe defaults.

---

## 4) UX / flows (Backup Center only)
> **Mode safety:** No new global keybinds; keep behavior inside Backup Center and modals. Preserve Esc/Enter modal semantics.

### 4.1 Entry point
**Backup Center → Cloud Backups → GitHub (CLI)**

Display a status panel:
- GitHub CLI detected: ✅/❌
- GitHub auth status: ✅/❌
- Active account: `<username>` (from `gh auth status`)
- Repo configured: ✅/❌
- Last push: `<timestamp>`
- Last restore pull: `<timestamp>`
- Auto-push policy: Off / On (policy name)

#### If `gh` missing
Modal with:
- Short explanation
- “Copy command” suggestion (`brew install gh` / platform guidance as text)
- Buttons: **Back**, **Re-check**

#### If `gh` present but not logged in
Modal with:
- “Run `gh auth login` in your terminal, then return and re-check.”
- Buttons: **Re-check**, **Back**

> Note: TADOI should **not** initiate a browser flow itself in v1; user completes login externally.

---

### 4.2 Connect remote (personal repo only)
Wizard modal steps:

**Step A — Repo selection**
- Option 1 (recommended): **Create new private repo** (default name `tadoi-backups`)
- Option 2: **Use existing repo** (user enters `owner/repo`)

**Constraints**
- Must be a **personal repo** (v1): enforce by requiring `owner == active gh user`.
- Must be **private** (strongly recommended): if repo is public, show a blocking warning and require explicit typed confirmation `PUBLIC` to proceed.

**Step B — Path policy**
- `deviceId` (auto-generated; stable per install; show label)
- Default `pathPrefix`: `tadoi/devices/<deviceId>/`
- Branch: `main` (fixed in v1 unless already exists; branch selection can be deferred)

**Step C — Save**
Persist non-secret config in settings:
- `githubBackup.enabled = true`
- `githubBackup.ownerRepo`
- `githubBackup.branch`
- `githubBackup.pathPrefix`
- `githubBackup.deviceId`
- `githubBackup.autoPushPolicy` (default Off)

---

### 4.3 Push snapshot (manual, v1 core)
**Action:** “Push snapshot now”

Flow:
1. Create snapshot artifacts (same source-of-truth as Backup Center export):
   - `state.json` (restore-grade, non-redacted)
   - `settings.json` snapshot
   - `manifest.json` (see §5)
2. Push to GitHub under:
   - `/<pathPrefix>/snapshots/YYYY/MM/<timestamp>.state.json`
   - `/<pathPrefix>/snapshots/YYYY/MM/<timestamp>.settings.json`
   - `/<pathPrefix>/snapshots/YYYY/MM/<timestamp>.manifest.json`
3. Update convenience pointers under:
   - `/<pathPrefix>/latest/state.json`
   - `/<pathPrefix>/latest/settings.json`
   - `/<pathPrefix>/latest/manifest.json`
4. Show result modal:
   - “Pushed snapshot: <timestamp>”
   - commit sha (if available)
   - failures show actionable errors (see §8)

**Commit message format (recommended)**
- `tadoi: backup <timestamp> device=<deviceId> rev=<stateRevision>`

---

### 4.4 Restore from GitHub (v1 core)
**Action:** “Restore from GitHub…”

Flow:
1. Fetch list of snapshots (most recent first)
   - Provide a list picker (scrollable), showing:
     - timestamp
     - task counts from manifest
     - app version / schema version
2. User selects snapshot → TADOI downloads to a temp staging location.
3. TADOI runs JSON import **dry-run** (merge or replace user-chosen).
4. Show dry-run summary:
   - tasks added/updated/removed
   - conflicts / errors
   - stateRevision delta (if relevant)
5. If dry-run clean: enable **Commit restore**
   - Commit triggers existing:
     - pre-import backup snapshot
     - atomic locked write to `tadoi_data.json`
6. Post-commit:
   - Offer optional “Push snapshot now” (to mark this device’s lane up to date)

> **Important:** Restore flow must **not** bypass your import gates. It is a transport layer only.

---

## 5) Snapshot artifacts & manifest schema
### 5.1 Snapshot artifact set
- `*.state.json` — export of TADOI canonical JSON state
- `*.settings.json` — settings snapshot (normalized/persisted settings)
- `*.manifest.json` — metadata for list/restore UX and validation

### 5.2 `manifest.json` (v1)
```json
{
  "tadoiBackupVersion": 1,
  "timestamp": "2026-02-27T05:12:30Z",
  "deviceId": "dev_ABC123",
  "ownerRepo": "user/tadoi-backups",
  "branch": "main",
  "pathPrefix": "tadoi/devices/dev_ABC123",
  "appVersion": "0.3.9",
  "schemaVersion": 8,
  "stateRevision": 1234,
  "hashes": {
    "stateSha256": "<sha256>",
    "settingsSha256": "<sha256>"
  },
  "counts": {
    "tasksTotal": 250,
    "tasksOpen": 120,
    "tagsTotal": 40
  }
}
```

**Notes**
- Hashes are for integrity and to detect identical snapshots quickly.
- Keep schema minimal; do not embed secrets.

---

## 6) Auto-push policy (optional, but requested)
### 6.1 Requirements
- Auto-push is **opt-in**. Default Off.
- Must be **debounced/coalesced** to avoid excessive commits.
- Must not run during destructive flows that already create backups/import gates unless explicitly allowed.
- Must be resilient to offline/no-network; queue “pending push” state.

### 6.2 Proposed policies (v1)
#### Policy A — “On exit”
- When app is closing cleanly: if local state changed since last push, push a snapshot.

**Pros:** low noise, good coverage  
**Cons:** users who force-kill may miss pushes

#### Policy B — “Interval (15m)”
- Every 15 minutes while app running: if local state changed since last push, push.

**Pros:** decent protection, simple mental model  
**Cons:** could still generate many commits during heavy use (mitigate via “only if changed”)

#### Policy C — “On change (debounced)”
- After a “write-worthy” action (task add/edit/complete, settings save), schedule a push:
  - debounce window: 60–120 seconds
  - reset timer on subsequent changes
  - only push if not already pushing

**Pros:** feels like “sync” without being realtime  
**Cons:** highest commit volume; needs careful coalescing and rate-limit handling

### 6.3 v1 recommendation (ship)
- Implement **Policy A (On exit)** and **Policy B (Interval 15m)**.
- Defer Policy C unless you strongly want “push after edits” UX; it’s riskier for rate-limit / noise.

### 6.4 “Only if changed” definition
Track `lastPushedStateRevision` and `lastPushedSettingsRevision` (or hash).
- If current stateRevision/settings hash unchanged → skip push.
- If changed → push snapshot.

---

## 7) Implementation approach (how TADOI talks to GitHub via `gh`)
### 7.1 Principle
- TADOI should **not** request or store raw tokens.
- Avoid `gh auth token` (it prints tokens).
- Use `gh api` for GitHub operations; auth stays inside `gh`.

### 7.2 Minimal API needs
- Verify auth & username: `gh auth status` (parse)
- Repo existence / visibility: `gh repo view <owner/repo>` (or `gh api`)
- Create repo: `gh repo create <name> --private`
- Upload files & create commit:
  - Preferred: use Git Data API via `gh api` to create blobs/trees/commit in one commit (atomic multi-file).
  - Acceptable fallback: create/update files via Contents API (may require multiple operations; less atomic).

### 7.3 Atomicity expectations
- **Ideal:** a single commit that includes state/settings/manifest + latest pointers.
- **Minimum acceptable (v1):** consistent final state visible in repo after push completes. If partial failure occurs:
  - mark push as failed
  - next push retries and overwrites `latest/` pointers to a coherent snapshot.

---

## 8) Error handling & user-facing messages
### 8.1 Common failures
- `gh` not found
- not authenticated
- repo not found / not accessible
- repo is public (block unless typed `PUBLIC`)
- network error / rate limited
- remote write conflict (rare with device lane; possible for `latest/` if multiple TADOI instances on same device)

### 8.2 UX rules
- Errors must be actionable and short.
- Never show secrets.
- Provide “Retry” and “Back” consistently.
- Keep failure states inside Backup Center (do not crash app).

### 8.3 Observability
- Log non-sensitive diagnostics:
  - operation name (push/list/download)
  - repo/path
  - http status if available
  - `gh` exit code
- Provide “Copy debug info” (sanitized).

---

## 9) Storage & settings changes
Add a settings block (normalized, backward-compatible):
```ts
githubBackup?: {
  enabled: boolean;
  ownerRepo: string;          // "user/tadoi-backups"
  branch: string;             // "main"
  deviceId: string;           // stable per install
  pathPrefix: string;         // "tadoi/devices/<deviceId>"
  autoPushPolicy: "off" | "onExit" | "interval15m";
  lastPushed?: {
    stateRevision?: number;
    settingsHash?: string;
    timestamp?: string;
    remoteCommitSha?: string;
  };
}
```
**No secrets stored.** No tokens.

---

## 10) QA / test matrix
### 10.1 Setup tests
- gh missing → shows install guidance; feature disabled
- gh present, not logged in → shows login guidance; “Re-check” works after login
- create new private repo → success
- existing repo but owner != active user → blocked (v1 personal-only)

### 10.2 Push tests
- manual push succeeds, creates snapshot + latest pointers
- push skipped when no changes since last push
- offline push → failure message + pending push flag; retry later works
- partial failure (e.g., latest pointer update fails) → next push fixes latest pointers

### 10.3 Restore tests
- list snapshots paginates/scrolls; most recent first
- download selected snapshot
- dry-run merge/replace behaves identically to local file import
- commit restore triggers pre-import backup and atomic write
- restore blocked if dry-run errors (consistent with Backup Center gates)

### 10.4 Regression checks (must not change)
- keybind model unchanged outside Backup Center
- existing backup/export/import behavior unchanged for local files
- lock + atomic write invariants preserved
- optimistic `stateRevision` checks still enforced

---

## 11) Acceptance criteria (v1)
1. **Optional**: Feature is off by default; visible in Backup Center as optional connector.
2. **Personal repo only**: TADOI blocks org repos by requiring `owner == active gh username`.
3. **Push**: “Push snapshot now” writes timestamped snapshot + latest pointers to repo.
4. **Restore**: “Restore from GitHub” downloads snapshot and runs JSON import dry-run → commit gates.
5. **No secrets stored**: No token/PAT stored in settings or files; no `gh auth token` usage.
6. **Auto-push (if implemented in v1)**: supports at least `onExit` or `interval15m`; default Off; pushes only when changed.

---

## 12) Validation commands (developer/operator)
These commands are for local verification during development:
```bash
gh --version
gh auth status
gh repo view <user>/tadoi-backups
# Verify snapshot files exist
gh api repos/<user>/tadoi-backups/contents/tadoi/devices/<deviceId>/latest
```

---

## 13) Implementation checklist (file-level)
> Filenames are illustrative; align with your current repo structure.

- **Backup Center UI**
  - Add “Cloud Backups → GitHub (CLI)” panel
  - Add setup wizard modals and status rendering
  - Add push action + progress modal
  - Add restore list modal + selection + dry-run summary + commit button

- **GitHub adapter layer**
  - `src/backup/githubCli.ts` (or similar)
    - `detectGh()`, `getAuthStatus()`, `getActiveUsername()`
    - `ensureRepoPersonalPrivate()`
    - `createRepoIfRequested()`
    - `listSnapshots()`
    - `downloadSnapshot()`
    - `pushSnapshotAtomic()` (preferred) or `pushSnapshotNonAtomic()` (fallback)

- **Snapshot builder**
  - Reuse existing export code paths to generate state/settings and compute manifest/hashes.

- **Settings**
  - Extend settings normalization & persistence for `githubBackup` block.

- **Docs**
  - `docs/backup-center.md` update: document GitHub CLI backup option and flows.
  - Fix import exit code drift note separately (not required for GH feature, but recommended).

---

## 14) Open questions (intentionally resolved by this spec)
- **Org repos:** explicitly not supported in v1.
- **Auto-push:** allowed, but conservative (on-exit and/or interval).
- **Sync:** not in v1 (no automatic merges); restore is explicit via import gates.

---

## 15) Future extensions (v1.5+)
- “Sync Now” (pull latest from another device lane → dry-run merge → commit)
- Optional encryption toggle
- Org repo support with policy UX
- True multi-device sync (requires storage/merge model changes)
