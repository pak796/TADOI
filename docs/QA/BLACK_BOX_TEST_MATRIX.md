# TADOI™ Black Box Test Matrix

Verified as of 2026-02-20 (v0.4.0).

Focus: user-visible behavior with no code inspection.

| ID     | Area                  | Scenario                                    | Expected Result                                             | QA Link                      |
| ------ | --------------------- | ------------------------------------------- | ----------------------------------------------------------- | ---------------------------- | --- | ----- | ----- | -------- |
| BB-001 | Launch                | Start at `>=104x24`                         | App renders list mode without guard                         | `QA-001`                     |
| BB-002 | Layout guard          | Resize below minimum                        | Guard appears and blocks interaction                        | `QA-002`                     |
| BB-003 | Search                | `/` then search                             | Filtered list; exit via `Enter`/`Esc`                       | `QA-013`, `QA-014`           |
| BB-004 | Recurrence            | Create recurring task, complete/skip/snooze | Occurrence rules applied correctly                          | `QA-023`..`QA-028`           |
| BB-005 | Backup/Import         | Import with dry-run                         | Dry-run runs first; commit remains gated                    | `QA-033`, `QA-034`, `QA-055` |
| BB-006 | TITS In-App           | Open TITS, run `add`, close TITS            | TITS routes keys correctly and prints deterministic output  | `QA-065`, `QA-066`           |
| BB-007 | TITS Due/Recur        | Set/clear due and recurrence in TITS        | Due/recur rules apply with validation errors where expected | `QA-068`, `QA-069`           |
| BB-008 | TITS CLI              | Run wrapper and raw DSL forms               | CLI command parity holds for `add                           | done                         | due | recur | help` | `QA-070` |
| BB-009 | TITS CLI Lock         | Run CLI write command while app open        | Lock error is surfaced; mutation is blocked                 | `QA-071`                     |
| BB-010 | TITS Recurrence Spawn | Complete recurring task via TITS/CLI        | `open -> done` spawns next open occurrence exactly once     | `QA-072`                     |
