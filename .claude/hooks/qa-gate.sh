#!/usr/bin/env bash
# Stop hook — reminds Claude to run the post-build QA agents before finishing a
# session that changed gated files (per the routing table in CLAUDE.md).
#
# Fires at most once per stop cycle: it blocks the first time (exit 2, message
# fed back to Claude), then honors stop_hook_active on the follow-up so it can't
# loop. It nudges — it does not verify the agents actually ran.
set -uo pipefail

input="$(cat)"

# If we already nudged this cycle, let the session finish.
if printf '%s' "$input" | grep -q '"stop_hook_active":[[:space:]]*true'; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

# Changed files = un-pushed commits + staged + unstaged. The base is the
# branch's upstream (@{upstream}), so once a branch is pushed or merged the
# committed delta is empty and the gate stays quiet — it only fires on work
# that hasn't left this machine yet.
#
# If the branch has no upstream (never pushed), the whole branch is un-pushed:
# fall back to the fork point off main (refresh it best-effort first).
base="$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null)"
if [ -z "$base" ]; then
  git fetch --quiet --no-tags origin main 2>/dev/null || true
  base="$(git merge-base HEAD origin/main 2>/dev/null \
          || git merge-base HEAD main 2>/dev/null \
          || git rev-parse HEAD~1 2>/dev/null \
          || echo HEAD)"
fi
changed="$(
  {
    git diff --name-only "$base" HEAD 2>/dev/null
    git diff --name-only 2>/dev/null
    git diff --name-only --cached 2>/dev/null
  } | sort -u
)"
[ -z "$changed" ] && exit 0

agents=""
printf '%s\n' "$changed" | grep -Eq '^(components/.*\.tsx|app/.*\.tsx|app/globals\.css)$' && agents="$agents frontend-qa"
printf '%s\n' "$changed" | grep -Eq '^(app/api/.*\.ts|lib/.*\.ts)$' && agents="$agents backend-qa"
printf '%s\n' "$changed" | grep -Eq '^(app/api/|middleware\.ts|next\.config\.ts)' && agents="$agents security-reviewer"

# spaghetti: >50 lines changed OR a new file added in this branch.
lines="$(git diff "$base" HEAD --numstat 2>/dev/null | awk '{a+=$1+$2} END{print a+0}')"
newfiles="$(git diff "$base" HEAD --name-status 2>/dev/null | grep -c '^A')"
if [ "${lines:-0}" -gt 50 ] || [ "${newfiles:-0}" -gt 0 ]; then
  agents="$agents spaghetti"
fi

# Collapse to a sorted, single-spaced, trimmed list.
agents="$(printf '%s' "$agents" | tr ' ' '\n' | grep -v '^$' | sort -u | xargs)"
[ -z "$agents" ] && exit 0

echo "QA gate: this change touches gated paths. Per CLAUDE.md, run these post-build agents before finishing: ${agents}. Invoke each via the Agent tool against the diff, or state explicitly why they were skipped (e.g. 'skip QA')." >&2
exit 2
