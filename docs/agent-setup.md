# Agent Setup

Canonical agent definitions live in `docs/agents/` (committed). Claude Code reads agents from `~/.claude/agents/` (user-global) and `.claude/agents/` (project-local).

## Install (one-time)

Symlink — recommended, stays in sync as this repo evolves:

```bash
mkdir -p ~/.claude/agents
for f in docs/agents/*.md; do
  ln -sf "$(pwd)/$f" ~/.claude/agents/"$(basename "$f")"
done
```

Or copy — snapshot in time, won't track updates:

```bash
cp docs/agents/*.md ~/.claude/agents/
```

## Verify

Start a Claude Code session in this repo and ask: `which agents are available?` — the seven should be listed.

## The roster

| Agent | Phase | Model | Fires when |
|---|---|---|---|
| `system-analyst` | Plan | sonnet | New feature or non-trivial behavior change |
| `ux-designer` | Plan | sonnet | Diff will touch `components/**/*.tsx`, `app/**/*.tsx`, or styles |
| `cto` | Plan | sonnet | New dep, store schema change, new `lib/` module, cross-cutting refactor |
| `security-reviewer` | Post-build | haiku | Diff touches `app/api/**`, `middleware.ts`, `next.config.ts`, env vars, or new deps |
| `backend-qa` | Post-build | haiku | Diff touches `app/api/**/*.ts` or `lib/**/*.ts` |
| `frontend-qa` | Post-build | sonnet | Diff touches `components/**/*.tsx`, `app/**/*.tsx`, or `app/globals.css` |
| `spaghetti` | Post-build | haiku | Diff > ~50 lines OR new file added |

Routing logic and escalation rules live in `CLAUDE.md`.

## Token discipline

- One-line bugfix → no agents
- Backend-only change (API route or lib) → `backend-qa` + `spaghetti` only
- New UI feature → `ux-designer` (plan) + `frontend-qa` + `spaghetti` (post-build)
- New feature end-to-end → full plan phase + full post-build pack
- Override per turn: say `full team` or `skip QA` / `skip security`

Post-build agents are independent — always invoke them in a single message with parallel `Agent` calls.
