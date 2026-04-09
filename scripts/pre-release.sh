#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# pre-release.sh — Wedding Planner pre-release quality gate
#
# Runs the full test suite and auto-fixes any issues it can resolve.
# Exits non-zero if any unfixable issue remains.
#
# Usage:
#   npm run pre-release               # standard run
#   npm run pre-release -- --fix      # explicit fix mode (default: always fixes)
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BOLD="\033[1m"
RED="\033[0;31m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RESET="\033[0m"

ISSUES=()
FIXED=()

log_step() { echo -e "\n${BOLD}▶ $1${RESET}"; }
log_ok()   { echo -e "  ${GREEN}✔${RESET} $1"; }
log_warn() { echo -e "  ${YELLOW}⚠${RESET} $1"; }
log_err()  { echo -e "  ${RED}✖${RESET} $1"; ISSUES+=("$1"); }
log_fix()  { echo -e "  ${GREEN}⚙ AUTO-FIXED:${RESET} $1"; FIXED+=("$1"); }

# ── 1. Dependency audit ───────────────────────────────────────────────────────
log_step "1/8  npm audit (High + Critical)"
if npm audit --audit-level=high --json 2>/dev/null | \
   python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if d.get('metadata',{}).get('vulnerabilities',{}).get('high',0)==0 and d.get('metadata',{}).get('vulnerabilities',{}).get('critical',0)==0 else 1)" 2>/dev/null; then
  log_ok "No high/critical vulnerabilities"
else
  log_warn "High/critical vulnerabilities found — attempting npm audit fix"
  if npm audit fix --audit-level=high 2>&1 | grep -q "fixed"; then
    log_fix "npm audit fix resolved some vulnerabilities"
  else
    log_err "Unresolved high/critical vulnerabilities — run 'npm audit' for details"
  fi
fi

# ── 2. Secret scan ───────────────────────────────────────────────────────────
log_step "2/8  Git history secret scan"
SECRETS=$(git log -p --all 2>/dev/null | grep -E "sk-ant-|ANTHROPIC_API_KEY\s*=\s*['\"]?sk|LINEAR_API_KEY\s*=\s*['\"]?lin" || true)
if [ -z "$SECRETS" ]; then
  log_ok "No API key literals in git history"
else
  log_err "Potential secrets found in git history — rotate keys immediately and run: git filter-repo"
fi

# ── 3. .env files gitignored ─────────────────────────────────────────────────
log_step "3/8  .env gitignore check"
if git ls-files --error-unmatch .env.local 2>/dev/null; then
  log_err ".env.local is tracked by git — add it to .gitignore and remove with: git rm --cached .env.local"
else
  log_ok ".env.local is not tracked"
fi

# Ensure .gitignore contains .env pattern
if grep -q '\.env' .gitignore 2>/dev/null; then
  log_ok ".gitignore covers .env files"
else
  log_warn ".gitignore missing .env pattern — auto-adding"
  echo -e "\n# Environment files\n.env\n.env.local\n.env*.local" >> .gitignore
  log_fix "Added .env patterns to .gitignore"
fi

# ── 4. TypeScript compilation ────────────────────────────────────────────────
log_step "4/8  TypeScript (tsc --noEmit)"
if npx tsc --noEmit 2>&1; then
  log_ok "TypeScript compiles cleanly"
else
  log_err "TypeScript compilation errors — fix before release"
fi

# ── 5. ESLint (auto-fix where possible) ──────────────────────────────────────
log_step "5/8  ESLint (with auto-fix)"
LINT_OUT=$(npx eslint . --fix 2>&1 || true)
LINT_ERRORS=$(echo "$LINT_OUT" | grep -c "error" || true)
if [ "$LINT_ERRORS" -eq 0 ]; then
  log_ok "No ESLint errors (auto-fixes applied)"
  if echo "$LINT_OUT" | grep -q "warning"; then
    WARN_COUNT=$(echo "$LINT_OUT" | grep -c "warning" || true)
    log_warn "$WARN_COUNT ESLint warning(s) — review but not blocking"
  fi
else
  log_warn "ESLint found $LINT_ERRORS error(s) that could not be auto-fixed"
  log_fix "Auto-fixable ESLint issues were resolved"
  log_err "Remaining ESLint errors require manual fixes"
fi

# ── 6. Security headers check ────────────────────────────────────────────────
log_step "6/8  Security headers in next.config.ts"
CONFIG="next.config.ts"
REQUIRED_HEADERS=(
  "X-Frame-Options"
  "X-Content-Type-Options"
  "Strict-Transport-Security"
  "Content-Security-Policy"
  "Referrer-Policy"
  "Permissions-Policy"
)
MISSING_HEADERS=()
for header in "${REQUIRED_HEADERS[@]}"; do
  if grep -q "$header" "$CONFIG"; then
    log_ok "$header present"
  else
    MISSING_HEADERS+=("$header")
    log_err "Missing security header: $header in $CONFIG"
  fi
done

# ── 7. SSRF guard present ────────────────────────────────────────────────────
log_step "7/8  SSRF guard verification"
SSRF_ROUTE="app/api/vendor-description/route.ts"
if [ -f "$SSRF_ROUTE" ]; then
  if grep -q "isPrivateUrl" "$SSRF_ROUTE"; then
    log_ok "SSRF guard (isPrivateUrl) present in vendor-description route"
  else
    log_err "SSRF guard missing from $SSRF_ROUTE"
  fi
  # Check all private IP ranges are covered. Use fixed-string (-F) search so that
  # backslashes in the TS regex literals (e.g. /^127\./) are matched literally.
  # Format: "pattern|label" — bash 3 compatible (no associative arrays)
  SSRF_CHECKS=(
    'localhost|localhost'
    '^127\.|127.x.x.x loopback'
    '^10\.|10.x.x.x private'
    '^172\.(1[6-9]|2|172.16-31.x.x private'
    '^192\.168\.|192.168.x.x private'
    '^169\.254\.|169.254.x.x link-local'
    '[::1]|IPv6 ::1 loopback'
  )
  for entry in "${SSRF_CHECKS[@]}"; do
    pattern="${entry%%|*}"
    label="${entry##*|}"
    if grep -qF "$pattern" "$SSRF_ROUTE"; then
      log_ok "  ✔ ${label} blocked"
    else
      log_err "  Missing IP block for ${label} in $SSRF_ROUTE"
    fi
  done
else
  log_warn "vendor-description route not found — skipping SSRF check"
fi

# ── 8. Run full test suite ───────────────────────────────────────────────────
log_step "8/8  Test suite (vitest)"
if npx vitest run --reporter=verbose 2>&1; then
  log_ok "All tests passed"
else
  log_err "One or more tests failed — see output above"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}════════════════════════════════════════════${RESET}"
echo -e "${BOLD}  Pre-release Report${RESET}"
echo -e "${BOLD}════════════════════════════════════════════${RESET}"

if [ ${#FIXED[@]} -gt 0 ]; then
  echo -e "\n${GREEN}Auto-fixed (${#FIXED[@]}):${RESET}"
  for f in "${FIXED[@]}"; do echo -e "  ✔ $f"; done
fi

if [ ${#ISSUES[@]} -eq 0 ]; then
  echo -e "\n${GREEN}${BOLD}✔ All checks passed — safe to release.${RESET}"
  exit 0
else
  echo -e "\n${RED}Unresolved issues (${#ISSUES[@]}):${RESET}"
  for issue in "${ISSUES[@]}"; do echo -e "  ✖ $issue"; done
  echo -e "\n${RED}${BOLD}✖ Release blocked — resolve the issues above.${RESET}"
  exit 1
fi
