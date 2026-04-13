# Help/Settings Doc Drift Triage Backlog (2026-03-02)

## Scope

- Source artifacts:
  - `/tmp/help_settings_doc_drift.md`
  - `/tmp/help_settings_doc_drift.json`
- Goal: convert drift output into an actionable backlog ranked by severity.
- Runbook: `docs/audits/HELP_SETTINGS_DOC_DRIFT_RUNBOOK.md`.

## Evidence Snapshot

- Total findings: `145`
- Severity: `high=27`, `medium=27`, `low=91`
- Status: `verified=67`, `missing_evidence=78`, `unverified=0`
- Missing-evidence severity: `medium=5`, `low=73`, `high=0`
- Missing-evidence by doc:
  - `docs/TADOI_QA_Guide_v0.3.9.md`: `52`
  - `TADOI_SPEC_v0.3.9.md`: `24`
  - `docs/TADOI_Feature_List_v0.3.9.md`: `2`
- Path reality check: all `73/73` path-like missing-evidence claims resolve to existing repo files. This indicates evidence-matching/tooling drift, not missing files.

## Backlog by Severity

### Medium (P1)

| Backlog ID | Drift IDs                | Problem                                                                            | Action                                                                                                                                                   | User Impact                                                         | Effort | Dependency                            | Acceptance                                                       |
| ---------- | ------------------------ | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------ | ------------------------------------- | ---------------------------------------------------------------- |
| MED-01     | `DRIFT-029`, `DRIFT-094` | `src/app/keyRouter.test.ts` is referenced in docs but marked missing evidence.     | Update drift scan matching rules to treat repo-relative file path claims as direct evidence when path exists and is in scanned globs; re-run drift scan. | Medium: key routing evidence appears unreliable in spec/QA audits.  | S      | `spec-task-drift-guard` script update | Both IDs move to `verified` without doc text changes.            |
| MED-02     | `DRIFT-051`              | `TADOI_BackupCenter_InApp_Spec.md` cross-doc reference is marked missing evidence. | Extend drift scan to support `.md` cross-reference verification (doc-to-doc link checks).                                                                | Medium: spec dependency graph appears incomplete.                   | S      | Drift scan matcher update             | ID moves to `verified`; doc cross-link checks are deterministic. |
| MED-03     | `DRIFT-109`, `DRIFT-115` | Backup-center test-path claims are present but marked missing evidence.            | Add normalization for comma-delimited path lists in QA tables and inline lists; re-run scanner.                                                          | Medium: QA guide traceability appears stale despite existing tests. | S      | Drift scan parser update              | Both IDs move to `verified` on next scan.                        |

### Low (P2/P3)

| Backlog ID | Drift IDs                                                                                            | Problem                                                                                                                            | Action                                                                                                                            | User Impact                                           | Effort | Dependency                  | Acceptance                                                           |
| ---------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------ | --------------------------- | -------------------------------------------------------------------- |
| LOW-01     | `DRIFT-028`, `DRIFT-030`, `DRIFT-031`, `DRIFT-032`, `DRIFT-093`, `DRIFT-095`..`DRIFT-145` (53 total) | Large batch of test-path references marked missing evidence even though files exist.                                               | After MED parser fixes, bulk re-run drift scan and auto-close resolved IDs; keep unresolved IDs only if paths truly break.        | Low-Med: noisy drift reports obscure real gaps.       | M      | MED-01, MED-03              | At least `>90%` of this bucket auto-resolves to `verified`.          |
| LOW-02     | `DRIFT-040`..`DRIFT-050`, `DRIFT-052` (12 total)                                                     | Spec lists many supporting doc references with no evidence linkage.                                                                | Add explicit docs-link verification phase (existence + relative path validity) and normalize these references in spec appendices. | Low: doc traceability noise.                          | M      | MED-02                      | IDs resolve to `verified` or are explicitly removed/renamed in spec. |
| LOW-03     | `DRIFT-015`, `DRIFT-037`, `DRIFT-064`                                                                | Token normalization misses (`Shift+Tab`, `1..6`) in docs-vs-code claim matching.                                                   | Expand token normalization map (`Shift+Tab` aliases, ranged-token normalization for `1..6` / `+1..+6`).                           | Low: keybind/range claims appear unstable in reports. | S      | Matcher normalization rules | Tokens become machine-verifiable in all three docs.                  |
| LOW-04     | `DRIFT-033`, `DRIFT-034`, `DRIFT-035`                                                                | Source path claims (`src/state/calendarImportService.ts`, `src/cli/main.ts`, `src/domain/models.ts`) are not credited as evidence. | Add explicit source-path evidence mode for `.ts/.tsx` claims.                                                                     | Low: false negatives in implementation traceability.  | S      | MED-01 matcher update       | IDs move to `verified` without code changes.                         |
| LOW-05     | `DRIFT-036`, `DRIFT-070`                                                                             | Schema/token claims (`external.calendar`, `security.nonHttpLinkPolicy`) are too free-form for current matcher.                     | Add semantic token rules for dotted keys and namespace-like fields.                                                               | Low: schema docs under-reported as drift.             | S      | Matcher semantic token pass | IDs move to `verified` with token evidence paths.                    |

## High Severity Note

- No high-severity missing-evidence items were reported (`0` actionable high).
- Current high-severity items are already verified.

## Suggested Rollout Order

1. MED-01
2. MED-03
3. MED-02
4. LOW-01
5. LOW-04
6. LOW-03
7. LOW-05
8. LOW-02

## Deterministic Recheck Commands

```bash
bun run doc:drift:help-settings

# Direct invocation (same command as package script)
python3 scripts/doc-drift-scan.py \
  --repo-root . \
  --doc-glob TADOI_SPEC_v0.3.9.md \
  --doc-glob docs/TADOI_Feature_List_v0.3.9.md \
  --doc-glob docs/TADOI_QA_Guide_v0.3.9.md \
  --code-glob 'src/**/*' \
  --code-glob 'docs/**/*' \
  --code-glob '*.md' \
  --out-json /tmp/help_settings_doc_drift.recheck_final.json \
  --out-md /tmp/help_settings_doc_drift.recheck_final.md
```
