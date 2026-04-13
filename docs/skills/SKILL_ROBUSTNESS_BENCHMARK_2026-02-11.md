# Skill Robustness Benchmark (2026-02-11)

> Archival note (2026-02-13): This is a historical artifact. Path strings were normalized to current repository folder naming for operational consistency. Policy: `docs/ARCHIVAL_PATH_POLICY.md`.

## Summary

- Total skills scored: 25
- Baseline skills (pre-existing): 19
- New skills: 6
- Baseline average score: 53.11
- New skills average score: 94.67
- Relevant-slice P75 score: 75.50

## Threshold Results

- Each new skill >= 80: PASS
- New-skill average >= relevant-slice P75: PASS
- Scenario pass rate >= 90%: PASS (100.00%)

## New Skill Scores

| Skill                     | Trigger | Workflow | Determinism | Safety | Reuse | Total |
| ------------------------- | ------: | -------: | ----------: | -----: | ----: | ----: |
| `atomic-change-planner`   |      20 |       16 |          20 |     14 |    20 |    90 |
| `keybind-source-of-truth` |      20 |       20 |          20 |     20 |    20 |   100 |
| `release-readiness-gate`  |      12 |       20 |          20 |     20 |    20 |    92 |
| `safe-scope-enforcer`     |      12 |       20 |          20 |     20 |    20 |    92 |
| `session-handoff-capture` |      20 |       20 |          20 |     14 |    20 |    94 |
| `spec-task-drift-guard`   |      20 |       20 |          20 |     20 |    20 |   100 |

## Relevant Slice Scores

| Skill                           | Total |
| ------------------------------- | ----: |
| `brainstorming`                 |    30 |
| `find-skills`                   |    26 |
| `playwright`                    |    81 |
| `sentry`                        |    70 |
| `speech`                        |    86 |
| `ui-ux-pro-max`                 |    50 |
| `writing-clearly-and-concisely` |    42 |

## Notes

- Scores are weighted on trigger precision, workflow completeness, determinism, safety, and maintainability.
- New skills were evaluated against full installed baseline and focused relevant slice.
- Raw data: `/Users/patrickkazar/Library/CloudStorage/GoogleDrive-pakazar@gmail.com/Other computers/My Computer/Google Drive/CODE PROJECTS/TADOI/docs/skills/data/benchmark_scores_2026-02-11.json`
