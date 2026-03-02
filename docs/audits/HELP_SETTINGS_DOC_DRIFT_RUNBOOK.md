# Help/Settings Doc Drift Runbook

## Standard Command
Use the locked package script:

```bash
bun run doc:drift:help-settings
```

This writes:
- JSON: `/tmp/help_settings_doc_drift.recheck_final.json`
- Markdown: `/tmp/help_settings_doc_drift.recheck_final.md`

## Direct Invocation (Equivalent)
```bash
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

## Auto-Close Diff Against Baseline
If comparing against a baseline file (for example `/tmp/help_settings_doc_drift.json`), run:

```bash
python3 - <<'PY'
import json
from collections import Counter
old=json.load(open('/tmp/help_settings_doc_drift.json'))
new=json.load(open('/tmp/help_settings_doc_drift.recheck_final.json'))
old_by={f['id']:f for f in old}
new_by={f['id']:f for f in new}
resolved=[fid for fid,of in old_by.items() if new_by.get(fid) and of['status']=='missing_evidence' and new_by[fid]['status']=='verified']
remaining=[fid for fid,of in old_by.items() if new_by.get(fid) and of['status']=='missing_evidence' and new_by[fid]['status']!='verified']
regress=[fid for fid,of in old_by.items() if new_by.get(fid) and of['status']=='verified' and new_by[fid]['status']!='verified']
print('OLD',Counter(f['status'] for f in old))
print('NEW',Counter(f['status'] for f in new))
print('RESOLVED',len(resolved))
print('REMAINING',len(remaining))
print('REGRESSIONS',len(regress))
PY
```

## Policy
- For Help/Settings drift checks, do not call `$CODEX_HOME/skills/spec-task-drift-guard/scripts/doc_drift_scan.py` directly.
- Use `scripts/doc-drift-scan.py` (or the package alias) to ensure matcher parity with current Help/Settings audit workflow.
