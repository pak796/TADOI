# DECISION_PACKET.md

> Archival note (2026-02-13): This packet preserves historical references captured when the repository folder was named `TUI_TODO`. Absolute paths may include that legacy folder name; the current folder name is `TADOI`.

## TL;DR (Recommended Path)
1. **Theme token semantics:** Treat the **internal token model as done**, but add a **non-power-user Simple Theme UX** (presets + guided categories + live preview) while keeping the current editor under an **Advanced** entry. Do not rename internal tokens in this cycle.
2. **Dashboard + tag filter behavior:** Treat **filter semantics and routing as canonical now** (status/due/search/tag precedence, list-dashboard parity), but label **dashboard presentation details** as “current behavior” for one minor release while we lock a small invariant test set and doc generation workflow.

## Grounding Snapshot (Repo-verified)
This packet is grounded in current implementation and docs in:
- `/Users/patrickkazar/Library/CloudStorage/GoogleDrive-pakazar@gmail.com/Other computers/My Computer/Google Drive/CODE PROJECTS/TUI_TODO/src/theme/themes.ts`
- `/Users/patrickkazar/Library/CloudStorage/GoogleDrive-pakazar@gmail.com/Other computers/My Computer/Google Drive/CODE PROJECTS/TUI_TODO/src/theme/custom1ColorUtils.ts`
- `/Users/patrickkazar/Library/CloudStorage/GoogleDrive-pakazar@gmail.com/Other computers/My Computer/Google Drive/CODE PROJECTS/TUI_TODO/src/components/Custom1ThemeEditor.tsx`
- `/Users/patrickkazar/Library/CloudStorage/GoogleDrive-pakazar@gmail.com/Other computers/My Computer/Google Drive/CODE PROJECTS/TUI_TODO/src/components/BuiltInThemeTextEditor.tsx`
- `/Users/patrickkazar/Library/CloudStorage/GoogleDrive-pakazar@gmail.com/Other computers/My Computer/Google Drive/CODE PROJECTS/TUI_TODO/src/app/App.tsx`
- `/Users/patrickkazar/Library/CloudStorage/GoogleDrive-pakazar@gmail.com/Other computers/My Computer/Google Drive/CODE PROJECTS/TUI_TODO/src/domain/tagFilter.ts`
- `/Users/patrickkazar/Library/CloudStorage/GoogleDrive-pakazar@gmail.com/Other computers/My Computer/Google Drive/CODE PROJECTS/TUI_TODO/src/domain/query.ts`
- `/Users/patrickkazar/Library/CloudStorage/GoogleDrive-pakazar@gmail.com/Other computers/My Computer/Google Drive/CODE PROJECTS/TUI_TODO/src/domain/taskRows.ts`
- `/Users/patrickkazar/Library/CloudStorage/GoogleDrive-pakazar@gmail.com/Other computers/My Computer/Google Drive/CODE PROJECTS/TUI_TODO/src/components/DashboardPane.tsx`
- `/Users/patrickkazar/Library/CloudStorage/GoogleDrive-pakazar@gmail.com/Other computers/My Computer/Google Drive/CODE PROJECTS/TUI_TODO/src/app/keyRouter.ts`
- `/Users/patrickkazar/Library/CloudStorage/GoogleDrive-pakazar@gmail.com/Other computers/My Computer/Google Drive/CODE PROJECTS/TUI_TODO/TADOI_SPEC_v0.3.4.md`
- `/Users/patrickkazar/Library/CloudStorage/GoogleDrive-pakazar@gmail.com/Other computers/My Computer/Google Drive/CODE PROJECTS/TUI_TODO/DASHBOARD_SPEC_MVP.md`
- `/Users/patrickkazar/Library/CloudStorage/GoogleDrive-pakazar@gmail.com/Other computers/My Computer/Google Drive/CODE PROJECTS/TUI_TODO/README.md`

---

## Option Summary Table

| Decision | Option | UX Impact | Eng Impact | Risk | Recommendation |
|---|---|---|---|---|---|
| Theme token semantics | 1. Keep semantics, add Simple mode + presets, Advanced toggle | Big gain for non-power users, zero loss for power users | Medium | Low-Medium | Strong candidate |
| Theme token semantics | 2. Rename/simplify token taxonomy internally | Cleaner mental model if perfect | High (migration + docs + regressions) | High | Not now |
| Theme token semantics | 3. Hybrid: internal semantics unchanged, guided categories + preview + safe rails | Strong gain, minimal migration risk | Medium | Low | **Recommended** |
| Theme token semantics | 4. Keep current editor only | No eng work | Low short-term, high adoption cost | Medium-High | Not recommended |
| Dashboard + tag filter behavior | 1. Canonical now; changes treated as breaking | Strong consistency | Low-Medium | Medium (locks too early) | Partial |
| Dashboard + tag filter behavior | 2. “Current behavior” + Experimental label | Maximum iteration flexibility | Low | Medium (docs ambiguity) | Partial |
| Dashboard + tag filter behavior | 3. Freeze invariants first, then canonical | Reduces churn while preserving quality | Medium | Low | **Recommended** |
| Dashboard + tag filter behavior | 4. Split: core canonical, presentation experimental | Practical compromise | Medium | Low-Medium | Pair with Option 3 |

---

## A) Decision Framing

## Decision 1: Theme Token Semantics vs Simpler UX

### Problem statement
TADOI currently has a powerful theme system with global tokens, per-object overrides, and built-in text tuning. This is expressive, but cognitively heavy for non-power users. The current entry path is deep (Help → Settings → Theme → Custom1/Text Tuning), and token names (`accent`, `accent2`, `selectionBg`) are implementation-oriented, not user-mental-model-first.

Internally, semantics are stable and tested. Externally, the UX is still “expert-first.” The decision is whether to call the feature done as-is or add a simplified layer without destabilizing theme internals.

### Who is impacted
- Power users: want direct token control, precise overrides, keyboard-driven editing.
- Non-power users: want quick customization, safe presets, understandable categories, confidence they cannot break readability.
- Docs/QA owners: need stable terms and lower explanation burden.

### Definition of done
- Non-power users can successfully apply a branded look in under 2 minutes without understanding token internals.
- Power users retain full existing capability with no regression.
- No persistence migration is required for existing `customThemes` payloads.
- Theme docs can explain both paths in one page without ambiguity.

### Decision criteria (ranked)
1. Usability
2. Learnability
3. Maintainability
4. Consistency
5. Docs burden
6. Migration risk
7. Extensibility

---

## Decision 2: Dashboard + Tag Filter Canonical vs Iterative

### Problem statement
Filter semantics and dashboard behavior are already deeply implemented and documented. Core contracts exist across query/task row expansion/routing, and test coverage is strong. However, some dashboard presentation and interaction details may still evolve (compact rendering, top-tags affordances, copy/UI refinements). The decision is whether to freeze behavior now as canonical or keep an iteration buffer.

The wrong call either causes churn (if too loose) or blocks healthy UX refinements (if frozen too early). We need a stability boundary that protects users and docs while allowing low-risk polish.

### Who is impacted
- End users: expect predictable filtering and dashboard parity.
- QA/docs: need stable authoritative rules and low drift.
- Engineering: needs room for visual/interaction polish without “breaking change” overhead for every tweak.

### Definition of done
- Core filtering/routing/parity behavior has explicit invariant tests and is marked canonical.
- Documentation clearly separates canonical contract vs changeable presentation details.
- Changes to canonical behavior require release-note callouts and migration guidance.
- Docs drift checks are part of release readiness.

### Decision criteria (ranked)
1. Consistency
2. Maintainability
3. Docs burden
4. Migration risk
5. Usability
6. Learnability
7. Extensibility

---

## B) Options

## Decision 1 Options (Theme Semantics)

### Option 1: Keep semantics, add Simple mode + presets, Advanced toggle
- Description: Maintain current token schema; add beginner-facing “Simple Theme” controls with curated presets and limited safe knobs.
- Pros: Fastest user win; backward-compatible; minimal risk.
- Cons: Two mental models to maintain; requires clear docs language.
- Engineering impact: `/src/app/App.tsx`, `/src/components/Custom1ThemeEditor.tsx`, `/src/settings/settings.ts`, `/src/state/settingsStore.ts`, `/src/theme/themes.ts`.
- Risk + mitigation: Risk of mode confusion; mitigate with explicit labels (“Simple” vs “Advanced”) and one-way “Open Advanced” affordance.
- Fast checks: 5-task usability script; verify power-user editor unchanged.

### Option 2: Simplify/rename internal taxonomy to user language
- Description: Rename/restructure token keys and semantics to surface-based categories.
- Pros: Cleaner long-term model if fully executed.
- Cons: High migration risk; widespread code/docs/test touch; high churn.
- Engineering impact: theme model, persistence normalization, editor components, tests, docs, potential migration logic.
- Risk + mitigation: Risk of breaking existing custom themes; mitigate with migration map and fallback compatibility layer.
- Fast checks: migration fixture tests + backward load tests + snapshot parity.

### Option 3: Hybrid: internal semantics unchanged, guided categories + preview rails
- Description: Keep internal token keys; introduce user-facing grouped categories (Surface/Text/Accent/State), guided editing flow, contrast guard rails, and live preview.
- Pros: Best balance of UX gain and low migration risk; preserves power path.
- Cons: Additional UI logic layer.
- Engineering impact: add guided editor component and mapping layer; no schema break.
- Risk + mitigation: Risk of mismatch between grouped labels and true token effects; mitigate with deterministic mapping table and previews.
- Fast checks: scenario tests + contrast/readability checks.

### Option 4: Keep current model and editor only
- Description: No UX simplification; call semantics done.
- Pros: No implementation cost.
- Cons: Non-power-user adoption and docs burden remain high.
- Engineering impact: none.
- Risk + mitigation: Risk of low discoverability; mitigation is docs only (insufficient).
- Fast checks: none (status quo).

---

## Decision 2 Options (Dashboard + Tag Filter Stability)

### Option 1: Canonical now, every change treated as breaking
- Description: Freeze all behavior and docs immediately.
- Pros: Maximum predictability.
- Cons: Over-constrains legitimate UI polish.
- Engineering impact: process-heavy release notes even for minor UX adjustments.
- Risk + mitigation: Risk of slow iteration; mitigate with strict change classification policy.
- Fast checks: compare changed behavior against canonical matrix.

### Option 2: “Current behavior” with Experimental stability label
- Description: Keep docs descriptive, not contractual.
- Pros: Iteration flexibility.
- Cons: Ambiguity and repeated docs churn.
- Engineering impact: low now, high recurring docs cost.
- Risk + mitigation: Risk of user confusion; mitigate with “as of version” stamps.
- Fast checks: docs diff + QA guide updates per release.

### Option 3: Freeze invariants first, then canonical
- Description: Define and lock core invariants in tests; canonicalize once invariants are green and documented.
- Pros: Balanced stability + safe iteration.
- Cons: Requires a short hardening phase.
- Engineering impact: adds invariant tests and docs contract table.
- Risk + mitigation: Risk of incomplete invariant set; mitigate with explicit go/no-go checklist.
- Fast checks: invariant suite + key router docs sync check.

### Option 4: Split stability levels (core canonical, presentation iterative)
- Description: Canonicalize filter semantics/routing/parity; mark dashboard rendering details as “current behavior.”
- Pros: Pragmatic and low churn.
- Cons: Requires disciplined classification.
- Engineering impact: doc labels + release-note taxonomy.
- Risk + mitigation: Risk of blurred boundaries; mitigate with canonical matrix in spec.
- Fast checks: classification gate in PR template.

---

## C) Recommendation

## Decision 1 Recommendation
**Pick Option 3 (Hybrid), implemented via Option 1 rollout pattern.**

Why:
- Preserves tested internals and avoids persistence migration risk.
- Delivers immediate non-power-user usability gains.
- Keeps advanced workflows intact for power users.
- Minimizes rework and docs churn.

Explicit anti-scope:
- Do not rename internal theme token keys this cycle.
- Do not remove existing advanced editors.
- Do not add theme import/export packs in this decision cycle.

## Decision 2 Recommendation
**Pick Option 3 + Option 4.**

Why:
- Core semantics are already mature and heavily tested.
- We can freeze what matters (filter precedence, parity, routing) while retaining room for layout/presentation polish.
- This gives docs a stable contract and engineering controlled iteration latitude.

Explicit anti-scope:
- Do not change core filter semantics in this cycle.
- Do not add new filter dimensions or dashboard widgets in this decision packet scope.
- Do not re-open due-window definitions (`next7`, `today`, `overdue`) unless a canonical change request is explicitly approved.

---

## Important API / Interface / Type Changes (Proposed)
1. Add optional settings field:
- `ui.themeEditorExperience?: "simple" | "advanced"` (default `"simple"` for new users; existing installs default to `"advanced"` if custom themes already present).
2. Add optional settings field:
- `ui.themeSimplePreset?: string` (only for simple mode UX state; does not replace `customThemes` data).
3. No change to existing `ThemeTokens`, `CustomThemes`, `Filters`, `TagFilter` contracts in this cycle.
4. Add a docs-level stability taxonomy:
- `Stability: Canonical | Current Behavior (May Change)` in spec sections.

---

## D) Execution Plan

## Phase 0: Fact Gathering (1 sprint day)
1. Build behavior inventory matrix.
- Deliverable: `theme-mapping-matrix.md` with token-to-user-category map.
- Deliverable: `dashboard-filter-invariants.md` listing canonical invariants.
2. Confirm existing docs claims vs code truth.
- Deliverable: drift checklist against `/README.md`, `/TADOI_SPEC_v0.3.4.md`, `/DASHBOARD_SPEC_MVP.md`.

Stop/Go gate:
- Go only if all current behaviors are classified as `core invariant` or `presentation`.

## Phase 1: Minimal Validation (2–3 days)
1. Heuristic UX review for non-power users.
- Scenario: “Set a new theme in under 2 minutes.”
- Scenario: “Use dashboard and tag filters predictably from list/dashboard/left rail.”
2. Scenario test pass/fail matrix with 6 tasks per persona.

Stop/Go gate:
- Go if non-power scenario completion ≥ 80% and no invariant ambiguity remains.

## Phase 2: Implementation (if needed)
1. Theme simple UX layer.
- Add simple editor mode with curated presets and grouped controls.
- Keep Advanced editor unchanged and directly accessible.
2. Stability hardening for dashboard/filter.
- Add invariant tests for precedence, parity, due windows, and key routing.
- Add classification labels in code comments/spec anchors.

Deliverables:
- New simple-theme component and tests.
- Invariant test suite updates in query/taskRows/keyRouter domains.

Stop/Go gate:
- Go only when all invariant tests are green and no persistence migration is required.

## Phase 3: Documentation Strategy Execution
1. Publish single source of truth updates.
- Update spec and README with stability labels.
- Add “As of vX.Y” headers for relevant sections.
2. Publish change classification rules.
- Canonical change requires release-note callout and migration note.
- Presentation changes require “current behavior” note only.

Deliverables:
- `DECISION_PACKET.md` finalized.
- Updated product/spec/docs pages with stability tags.

Stop/Go gate:
- Go if docs and tests agree on all canonical invariants.

## Phase 4: Post-Ship Measurement and Follow-ups (1 release cycle)
1. Collect signals.
- QA escape rate in theme setup scenarios.
- Number of docs clarifications/issues related to tag/filter/dashboard behavior.
- Regression count in invariant tests.
2. Decide whether to promote remaining “current behavior” items to canonical.

Deliverable:
- `post-ship-decision-review.md` with promote/defer decisions.

---

## Acceptance Checklist

- [ ] Non-power users can complete “apply branded theme” without entering Advanced mode.
- [ ] Power-user theme workflows are unchanged.
- [ ] No persistence schema migration required for theme changes.
- [ ] Core dashboard/filter invariants are explicitly tested and pass.
- [ ] Docs clearly label canonical vs current behavior sections.
- [ ] Release notes include canonical-behavior changes only when applicable.

---

## Test Cases and Scenarios

1. Theme simple mode:
- New user applies preset, adjusts 3 safe controls, saves, restarts, and sees persistence.
2. Theme advanced mode:
- Existing custom1/object overrides remain untouched.
3. Tag precedence:
- Non-empty `tagFilter` overrides legacy `tag` in list and dashboard.
4. Parity:
- Dashboard KPI/top-tags computed from same visible-row filtered set as list.
5. Due-window boundaries:
- `next7` is `today..+6`; `today` and `overdue` behavior unchanged.
6. Routing:
- Dashboard blocks list-key leakage; tag panel blocks list/dashboard routing while active.
7. Saved views:
- Snapshot/apply preserves normalized `tagFilter` and precedence rules.
8. Docs contract:
- Canonical matrix lines map 1:1 to invariant tests.

---

## Risk Register (Top 5)

| Risk | Impact | Mitigation |
|---|---|---|
| Simple mode and advanced mode diverge semantically | User confusion | Single mapping table from simple controls to internal tokens; test lock |
| Over-freezing dashboard behavior too early | Slower UX improvements | Core/presentation split with explicit stability labels |
| Docs drift from runtime | Support burden | Invariant tests + docs sync checklist in release gate |
| Hidden regression in filter precedence | Incorrect task visibility | Dedicated precedence tests in `query` and `taskRows` |
| Power users feel constrained by defaults | Adoption friction | Keep Advanced fully available; no capability removal |

---

## E) Documentation Strategy (Explicit)

## Recommendation
Use a **hybrid model**:
- **Canonical now** for core filter/routing/parity semantics.
- **Living doc labels** for dashboard presentation details and theme onboarding UX during one minor release.

## Labeling rules
- Every relevant section starts with `As of vX.Y`.
- Add `Stability: Canonical` or `Stability: Current Behavior (May Change)`.
- Canonical changes require:
  - release note entry,
  - test update,
  - migration note if user behavior meaning changes.
- Current-behavior changes require:
  - changelog note under UX refinements,
  - no migration note unless user workflow breaks.

## Where to record
- Product/runtime contract: `/TADOI_SPEC_v0.3.4.md` (next versioned update).
- Dashboard contract: `/DASHBOARD_SPEC_MVP.md`.
- User-facing behavior: `/README.md`.
- QA executable contract: `/docs/TADOI_QA_Guide_v0.3.4.md`.

---

## Explicit Assumptions and Defaults

1. Existing internal token schema (`ThemeTokens`) remains stable this cycle.
2. Existing `customThemes` payload remains backward-compatible with no migration.
3. Dashboard core semantics are mature enough to freeze after invariant hardening.
4. One minor release of dual labeling (`Canonical` + `Current Behavior`) is acceptable to reduce churn.
5. Telemetry is not required; validation can be scenario/QA-driven.
