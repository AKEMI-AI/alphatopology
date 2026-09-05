# Claude Code and Codex Workflow

GitHub `main` is the shared source of truth. Chat transcripts are useful
context, but they are not synchronization or durable project state.

## One task, one owner, one branch

1. Create or select a GitHub issue with a goal and acceptance criteria.
2. Assign the implementation to Claude Code or Codex.
3. Fetch the latest `main` and start an isolated branch/worktree.
4. Commit small, coherent checkpoints and push the branch.
5. Open a pull request using the handoff template below.
6. Have the other system review the diff and test evidence.
7. Merge only after required checks pass.
8. Both systems fetch the new `main` before starting dependent work.

Branch names identify the owner and issue:

```text
claude/12-copilot-panel
codex/13-data-provenance
```

Never allow Claude Code and Codex to edit the same branch or working directory
simultaneously. Parallel work uses different worktrees and, preferably,
different files or modules.

## Durable context

- `docs/ARCHITECTURE.md` — boundaries and non-negotiable invariants
- `docs/ROADMAP.md` — current sequence and acceptance outcomes
- `docs/decisions/` — architectural decision records
- `AGENTS.md` — shared repository and Codex instructions
- `CLAUDE.md` — Claude-specific entry point that links shared documentation
- GitHub Issues/PRs — task state, handoffs, reviews, and validation evidence

When implementation changes a contract or architectural decision, update the
relevant document in the same pull request.

## Pull-request handoff

```text
Goal:
Issue:
Branch and base commit:
What changed:
Validation performed:
Data/source implications:
Known gaps:
Files needing special attention:
Recommended next action:
```

The reviewer should prioritize correctness, financial-data provenance,
look-ahead bias, failure behavior, security boundaries, and regression tests.

## Merge policy

- `main` is protected from direct feature work and force pushes.
- Pull requests require backend tests and frontend lint/type/build checks.
- No secrets, generated runtime telemetry, or local environments are committed.
- Fixture estimates stay clearly labeled in code, API responses, and UI.
- Live-execution functionality requires a separate approved design change.
