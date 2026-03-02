# Help/Settings Doc Drift Auto-Close (2026-03-02)

Runbook: `docs/audits/HELP_SETTINGS_DOC_DRIFT_RUNBOOK.md`.

## Implemented Matcher Work (Executed)
- MED-01: repo-relative path claims verify against scanned file paths.
- MED-03: comma-delimited path-list evidence in QA/spec tables verifies deterministically.
- LOW-01: bulk path-reference false negatives auto-resolved after matcher updates.
- LOW-04: source path (`.ts`/`.tsx`) claims map directly to scanned source files.
- LOW-03: token normalization for `Shift+Tab` and ranged token normalization (`+1..+6` -> `1..6`).
- LOW-05: dotted semantic token matching supports namespace/suffix evidence (for example `security.nonHttpLinkPolicy`, `external.calendar`).
- LOW-02: doc-reference evidence supports doc-relative and repo-relative `.md` path resolution when scanned.

## Drift Status Delta
- Baseline status counts (`/tmp/help_settings_doc_drift.json`): `{'verified': 67, 'missing_evidence': 78}`
- Recheck status counts (`/tmp/help_settings_doc_drift.recheck_final.json`): `{'verified': 145}`
- Auto-closed IDs: `78`
- Remaining missing-evidence IDs: `0`
- Regressions: `0`

## Closed IDs
DRIFT-015, DRIFT-028, DRIFT-029, DRIFT-030, DRIFT-031, DRIFT-032, DRIFT-033, DRIFT-034, DRIFT-035, DRIFT-036, DRIFT-037, DRIFT-040, DRIFT-041, DRIFT-042, DRIFT-043, DRIFT-044, DRIFT-045, DRIFT-046, DRIFT-047, DRIFT-048, DRIFT-049, DRIFT-050, DRIFT-051, DRIFT-052, DRIFT-064, DRIFT-070, DRIFT-093, DRIFT-094, DRIFT-095, DRIFT-096, DRIFT-097, DRIFT-098, DRIFT-099, DRIFT-100, DRIFT-101, DRIFT-102, DRIFT-103, DRIFT-104, DRIFT-105, DRIFT-106, DRIFT-107, DRIFT-108, DRIFT-109, DRIFT-110, DRIFT-111, DRIFT-112, DRIFT-113, DRIFT-114, DRIFT-115, DRIFT-116, DRIFT-117, DRIFT-118, DRIFT-119, DRIFT-120, DRIFT-121, DRIFT-122, DRIFT-123, DRIFT-124, DRIFT-125, DRIFT-126, DRIFT-127, DRIFT-128, DRIFT-129, DRIFT-130, DRIFT-131, DRIFT-132, DRIFT-133, DRIFT-134, DRIFT-135, DRIFT-136, DRIFT-137, DRIFT-138, DRIFT-139, DRIFT-140, DRIFT-141, DRIFT-142, DRIFT-143, DRIFT-145

## Remaining Missing-Evidence IDs
(none)

## Regression IDs
(none)

## Deterministic Commands
```bash
bun run doc:drift:help-settings

# Direct invocation (parity with package script)
python3 scripts/doc-drift-scan.py --repo-root . --doc-glob TADOI_SPEC_v0.3.9.md --doc-glob docs/TADOI_Feature_List_v0.3.9.md --doc-glob docs/TADOI_QA_Guide_v0.3.9.md --code-glob 'src/**/*' --code-glob 'docs/**/*' --code-glob '*.md' --out-json /tmp/help_settings_doc_drift.recheck_final.json --out-md /tmp/help_settings_doc_drift.recheck_final.md
```
