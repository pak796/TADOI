# Output Schema

JSON list item:

```json
{
  "id": "DRIFT-001",
  "severity": "high",
  "doc_path": "README.md",
  "evidence_paths": ["src/app/keyRouter.ts"],
  "claim": "Press Enter to apply filter",
  "status": "verified",
  "requires_code_change": false,
  "recommendation": "No action"
}
```

Status values:

- `verified`
- `unverified`
- `missing_evidence`

Recommendation guidance:

- Use concrete next action text.
- Include whether docs-only correction is possible.
