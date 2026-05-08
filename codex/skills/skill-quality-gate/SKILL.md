---
name: skill-quality-gate
description: Evaluate a newly created or substantially revised project-local Codex skill with empirical-prompt-tuning before considering it ready.
---

# Skill Quality Gate

Use this workflow whenever a project-local skill under `codex/skills/` is created or substantially revised.

This workflow composes `empirical-prompt-tuning`. It exists so this repository has a repeatable quality gate instead of relying on the skill author's self-review.

## Quality Bar

A skill is ready when:

- frontmatter `description` and body cover the same trigger and scope.
- at least two realistic scenarios have been evaluated, including one median case and one edge case.
- every scenario has at least one `[critical]` requirement.
- all `[critical]` requirements pass in the final round.
- accuracy is at least 85% for each final scenario.
- no new unclear points remain in the final round, or any remaining point is documented as an accepted limitation.
- when `tool_uses` or step counts are available, no scenario has a count 3x or more higher than the others without an explicit reason.
- when execution metadata is unavailable, the ledger explicitly records `measurement source: self-report only` and the evaluation relies on requirement achievement, trace quality, unclear points, discretionary fill-ins, and retries.
- evaluation notes and failure patterns are recorded in `codex/ledger/skill-evaluations.md`.

For high-importance skills, require two consecutive clean rounds before marking the skill ready.

## Workflow

1. Identify the target skill path, usually `codex/skills/<name>/SKILL.md`.
2. Read the target skill and run iteration 0 from `empirical-prompt-tuning`: compare the frontmatter `description` with the body.
3. Define 2 to 3 evaluation scenarios:
   - one normal workflow the skill should handle.
   - one edge case involving ambiguity, missing context, or failure handling.
   - one optional hold-out scenario for high-importance skills.
4. For each scenario, write a fixed requirements checklist with 3 to 7 items and at least one `[critical]` item.
5. Dispatch fresh subagents using the `empirical-prompt-tuning` subagent invocation contract. Do not evaluate only by rereading your own writing.
6. Record success/failure, accuracy, measurement source, tool uses or steps when available, duration when available, retries, unclear points, discretionary fill-ins, and weak phase.
7. Apply one small instruction fix theme to the target skill when the evaluation surfaces a preventable unclear point.
8. Repeat with fresh subagents until the quality bar is met, convergence is reached, or the evaluation shows the skill needs a larger rewrite.
9. Record the final decision in `codex/ledger/skill-evaluations.md`.

## Metric Capture

Use the most objective metrics the execution environment exposes:

1. Prefer subagent usage metadata such as `tool_uses` and `duration_ms`.
2. If usage metadata is unavailable, record `measurement source: self-report only`.
3. In self-report-only mode, require the executor report to include requirement achievement, trace, unclear points, discretionary fill-ins, and retries. Do not invent tool counts or durations.
4. Treat self-report-only mode as an accepted limitation for normal project-local skills. For high-importance skills, run an additional hold-out scenario or repeat the evaluation in an environment that exposes usage metadata.

## Dispatch Unavailable

If fresh subagents cannot be dispatched, do not claim empirical evaluation passed. Run only the static description/body consistency check and record:

`Result: Blocked - empirical evaluation skipped because subagent dispatch was unavailable.`

## Missing Target Skill

If the target skill file does not exist or cannot be read, stop before scenario execution. Do not infer quality from the skill name alone. Record:

`Result: Blocked - target skill file was unavailable, so static and empirical evaluation could not be completed.`

Scenarios may be drafted as provisional setup, but they must be revisited after the target skill can be read.

## Ledger Format

Append entries to `codex/ledger/skill-evaluations.md` using this shape:

```markdown
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
```

## Final Report

Include:

- target skill.
- final quality-gate result.
- scenarios run and final scores.
- fixes applied to the skill.
- ledger entry location.
- any skipped checks or accepted limitations.
