# Skill Evaluation Log

Use this file to record empirical-prompt-tuning runs for project-local skills.

## Template

### YYYY-MM-DD HH:MM - <skill-name>

- Target: `codex/skills/<skill-name>/SKILL.md`
- Change scope:
- Evaluator:
- Result: Passed | Passed with accepted limitations | Failed | Blocked
- Measurement source: usage metadata | self-report only | not run
- Scenarios:
  - <scenario name>: <success/failure>, <accuracy>, <steps/tool_uses>, <duration if available>, <weak phase>
- Critical failures:
- New unclear points:
- Discretionary fill-ins:
- Failure pattern ledger updates:
- Fixes applied:
- Remaining risks:

## Runs

### 2026-05-09 07:20 - skill-quality-gate

- Target: `codex/skills/skill-quality-gate/SKILL.md`
- Change scope: New project-local skill quality gate workflow that composes `empirical-prompt-tuning`
- Evaluator: Codex parent session with two fresh executor subagents
- Result: Passed
- Measurement source: self-report only
- Scenarios:
  - Median new skill gate setup: success, 100%, steps/tool_uses not reported, duration not reported, weak phase: target-file availability handling
  - Dispatch unavailable edge: success, 100%, steps/tool_uses not reported, duration not reported, weak phase: none
- Critical failures:
  - None in final evaluation
- New unclear points:
  - Median scenario surfaced that a missing target skill file was not explicitly covered by the workflow.
- Discretionary fill-ins:
  - Median executor inferred provisional scenarios from a missing target skill name.
- Failure pattern ledger updates:
  - Added: missing target file must stop before empirical scenario execution.
- Fixes applied:
  - Added a `Missing Target Skill` section with required blocked result wording and a rule to revisit provisional scenarios after the target skill can be read.
  - Added `Metric Capture` rules so environments without usage metadata record `measurement source: self-report only` instead of inventing metrics or leaving the result as an unresolved risk.
- Remaining risks:
  - None for normal project-local skill evaluation. For high-importance skills, rerun with usage metadata or add a hold-out scenario as required by `skill-quality-gate`.
