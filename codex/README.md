# Project Codex Harness

This directory contains the repository-managed Codex harness for `codex-app-server`.

The source harness repository is:

- <https://github.com/s-hiraoku/codex-harnesses>

## Layout

- `skills/`: project-local task workflows copied from `codex-harnesses/skills`
- `hooks/`: hook payload examples copied from `codex-harnesses/hooks`
- `ledger/`: long-running task state, decisions, risks, and verification notes

Repository-level harness files live outside this directory:

- `AGENTS.md`: durable project guidance
- `policies/strict.yaml`: safety and verification policy
- `scripts/verify.sh`: repository verification entrypoint
- `scripts/checkpoint.sh`: append resumable state to `codex/ledger/current.md`

## Usage

Before a long-running task, read `AGENTS.md` and `codex/ledger/current.md`.

During the task, append checkpoints:

```bash
scripts/checkpoint.sh
```

When creating or substantially revising a project-local skill, run the `skill-quality-gate` workflow. It uses `empirical-prompt-tuning` to evaluate the skill with fresh executor agents, then records the result in `codex/ledger/skill-evaluations.md`.

Before finalizing meaningful changes, run:

```bash
scripts/verify.sh
```

The hook payloads in `codex/hooks/` are intentionally not registered automatically. Review and adapt them before wiring them into a Codex lifecycle configuration.

## Updating From codex-harnesses

Review upstream changes first, then copy only the pieces this repository actually uses. Avoid blindly replacing project-specific guidance or ledger state.
