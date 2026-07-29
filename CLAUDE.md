# Wedding Planner — CLAUDE.md

## What this is
A collaborative wedding planning app for Louis & partner. Built in Next.js 14 
with App Router. All AI calls go through Next.js API routes (never client-side).

## Key architecture decisions
- **State**: Zustand store in lib/plan-store.ts. Persists to localStorage.
  Shape: { answers: WeddingAnswers, vendors: Vendor[], tasks: Task[], guests: Guest[] }
- **AI routes**: /api/research and /api/advisor. Both use @anthropic-ai/sdk server-side.
  Never expose ANTHROPIC_API_KEY to the client.
- **Adaptive logic**: lib/plan-adapters.ts takes WeddingAnswers and returns 
  derived timeline[], budgetCategories[], tasks[]. All sections consume these adapters.
- **Research**: Each ResearchCard passes a `type` key. research-prompts.ts builds 
  the context-aware prompt from stored answers + type.

## Build sequence
1. Types + store (lib/)
2. API routes  
3. Intake questionnaire (Intake.tsx) — this drives everything
4. Overview + shell
5. Timeline, Budget, Tasks (all derived from answers via adapters)
6. Vendors + Guests (manual entry + tracking)
7. Research tab (calls /api/research)
8. Advisor tab (streaming chat via /api/advisor)

## Style rules
- Tailwind only, no inline styles
- Color palette: pink accent = #D4537E, use for CTAs and active states
- No emoji in UI except the final wedding day milestone
- All AI responses render in <pre className="whitespace-pre-wrap"> inside ResearchCard

## Intake questions (in order)
partner name (free text), date (exact date OR season+year), location (single), guests (single), 
budget (single), vibe (multi), priorities (multi, pick 3), setting (single), 
funding (single), stress (multi)

The date step offers an exact `<input type="date">` or a season + year fallback.
`WeddingAnswers.dateIsExact` records which one; when false the UI shows "Summer 2027
(date TBC)" rather than a specific day. All date parsing/formatting goes through
`lib/date-utils.ts` — never `new Date(iso).toLocaleDateString()` directly, which
renders the previous day west of UTC.

## Adaptive rules (plan-adapters.ts must implement these)
- outdoor setting → add tent/weather contingency tasks + flag in timeline
- photography priority → boost photo budget % by 5, note in tips
- food priority → boost catering budget % by 5
- mountain location → add "book early, venues fill 18mo out" warning
- under 50 guests → mark venue booking as "easier, more flexibility"
- 100k+ budget → unlock luxury vendor tier notes in research prompts

## Agent Roster — when to invoke whom

Canonical agent definitions live in `docs/agents/` (committed). Claude Code reads them from `~/.claude/agents/` — see `docs/agent-setup.md` for the symlink one-liner. Be conservative — token cost compounds. A one-line bugfix should run no agents.

### Plan phase (before any code)

| Agent | Invoke when | Skip when |
|---|---|---|
| `system-analyst` | New feature or non-trivial behavior change | Typo, one-liner, dep bump, pure refactor |
| `ux-designer` | Diff will touch `components/**/*.tsx`, `app/**/*.tsx`, or `app/globals.css` | Backend-only change, `lib/` or `app/api/` only |
| `cto` | New dependency, store schema change, new `lib/` module, new API route, cross-cutting refactor | Anything fully scoped to one existing module |

### Build phase

Main Claude writes the code. No agents run during the build.

### Post-build (run in parallel, gated by what the diff touched)

| Agent | Gate |
|---|---|
| `security-reviewer` | Diff touches `app/api/**`, `middleware.ts`, `next.config.ts`, env var handling, or new deps |
| `backend-qa` | Diff touches `app/api/**/*.ts` or `lib/**/*.ts` (outside components) |
| `frontend-qa` | Diff touches `components/**/*.tsx`, `app/**/*.tsx`, or `app/globals.css` |
| `spaghetti` | Diff > ~50 lines OR new file created |

### How to invoke

Use the `Agent` tool with `subagent_type` set to the agent's name. Pass the user's request, the relevant `git diff`, and the spec path if one exists — agents should not re-explore the repo from scratch. Post-build agents are independent: invoke them in a single message with parallel `Agent` calls.

### Escalation knob

User can say `full team` (run everything) or `skip QA` / `skip security` (drop specific agents this turn). Default is the conservative routing above.

### Known pitfalls (frontend agents must respect these)

- **Intake question order is fixed** — `Intake.tsx` must keep questions in the order defined in CLAUDE.md; `plan-adapters.ts` depends on it.
- **`ResearchCard` is the only AI prose renderer** — keep the `<pre className="whitespace-pre-wrap">` wrapper.
- **`BudgetBar` and `MetricCard`** are shared across Overview, Budget, and Compare — changes propagate to all three.
- **Milestones and tasks render on one page** — `Timeline.tsx` is a single combined list (Overdue / Upcoming / No date yet / Done) with a filter, not sub-tabs. Don't split it back apart.
- **Adapter-derived tasks aren't in the store until touched** — toggling one must materialise it via `addTask`; `toggleTask` alone is a no-op. Anything counting tasks must merge `tasks` with `defaultTasks`.
- **ESLint `// eslint-disable-line` comments** in `Topbar.tsx`, `Overview.tsx`, `Budget.tsx`, and `Research.tsx` are intentional — don't remove them.
- **No Anthropic SDK in client components** — all AI calls go through `/api/*` routes.
- **Zustand store version** — any new persisted field requires a migration case in `migratePlanStore()` with a bumped version number.

---

## Security

### Post-deployment security scan (required after every major deployment)

After every major deployment, perform a security scan covering the following and resolve any findings before the next release:

1. **Secrets / API keys** — confirm `.env*` files are gitignored and no secrets appear in git history (`git log -p | grep -i "sk-ant\|api_key\|secret"`). Revoke and rotate any exposed keys immediately.

2. **SSRF in vendor-description route** — `app/api/vendor-description/route.ts` fetches user-supplied URLs. Validate that private IP ranges (`127.x`, `10.x`, `172.16-31.x`, `192.168.x`, `169.254.x`, `::1`) and `localhost` are blocked before each fetch.

3. **Input validation on all API routes** — every route must reject unrecognised `type` values and malformed payloads with a 400 before passing data to Anthropic. Use `zod` for schema validation.

4. **Authentication / CSRF** — all `/api/*` routes must verify the request originates from the app (session cookie, CSRF token, or signed token). No unauthenticated calls to Anthropic should be possible from an external origin.

5. **Rate limiting** — `/api/research`, `/api/advisor`, `/api/research-chat`, `/api/recommendations`, and `/api/vendor-description` must enforce a per-IP rate limit to prevent cost-explosion attacks. Target: ≤ 20 AI calls / hour / IP.

6. **Security headers** — `next.config.ts` must set `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, `Referrer-Policy`, and `Permissions-Policy` on all responses.

7. **CORS** — API routes must only accept requests from the app's own origin. Verify `Access-Control-Allow-Origin` is not wildcard in production.

8. **Error responses** — no stack traces, file paths, or internal error details in API responses. Generic message + opaque error ID only.

9. **Request size limits** — confirm `bodyParser.sizeLimit` (≤ 1 MB) is set in `next.config.ts` to prevent memory-exhaustion payloads.

10. **Dependency audit** — run `npm audit --audit-level=high` and resolve all High/Critical findings.

### Scan checklist template

```
[ ] git history contains no secrets
[ ] SSRF IP blocklist verified in vendor-description route
[ ] All API inputs validated with zod
[ ] Auth / CSRF token checked on every API route
[ ] Rate limiting active and tested
[ ] Security headers present (verified with securityheaders.com or curl -I)
[ ] CORS restricted to production origin
[ ] No stack traces in error responses
[ ] Request body size limit configured
[ ] npm audit passes (no High/Critical)
```

Open a Linear issue for any finding that cannot be resolved before deployment. Tag it `security` and do not close it until verified fixed in production.

---

## Test plan & pre-release gate

### Running tests

```bash
npm test                  # run full suite once (CI / pre-commit)
npm run test:watch        # interactive watch mode (development)
npm run test:coverage     # run with V8 coverage report
npm run pre-release       # full pre-release gate (tests + lint + audit + security checks)
```

### Test suite layout

```
tests/
├── setup.ts                        # global setup (suppress console.error noise)
├── unit/
│   ├── adapters.test.ts            # buildTimeline, buildBudgetCategories, buildInitialTasks
│   ├── date-utils.test.ts          # local-time parsing, season mapping, exact vs approximate
│   ├── guest-probability.test.ts   # getBaseProbability, guestExpectedCount, estimatedAttendance
│   └── research-prompts.test.ts    # buildResearchPrompt — all types + context flags
├── components/
│   ├── ResearchCard.test.tsx       # sole AI-prose renderer
│   └── Timeline.test.tsx           # combined milestones + tasks page
├── api/
│   ├── research.test.ts            # input validation, type allowlist, error safety
│   ├── recommendations.test.ts     # JSON parsing, URL filtering, status normalisation
│   ├── vendor-description.test.ts  # SSRF guard (isPrivateUrl) + route behaviour
│   └── feedback.test.ts            # zod validation, length limits, error safety
├── security/
│   └── middleware.test.ts          # rate limiting, bot UA blocking, CORS, session auth
└── integration/
    └── pre-release.test.ts         # structural checks: security headers, gitignore,
                                    # secret scan, middleware coverage, tsc --noEmit
```

### What each layer covers

| Layer | Coverage |
|---|---|
| **Unit** | All pure adapter logic and adaptive rules. Every branch (outdoor, mountain, luxury, small guest count, priority boosts). |
| **API** | Input validation on every public route. Mocked Anthropic SDK — no real API calls. URL safety (https-only filter). JSON resilience (code-block extraction). |
| **Security** | All 8 bot UA patterns blocked. Session cookie required on API routes. Login rate-limited at 5 req/min. CORS preflight and origin blocking. |
| **Integration** | File existence, secret hygiene, TypeScript compilation, security header presence in config. |

### Mock pattern (required for Anthropic routes)

Always use a class-based mock — arrow functions can't be `new`-ed:

```typescript
vi.mock("@anthropic-ai/sdk", () => {
  class MockAnthropic {
    messages = { create: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "..." }] }) };
  }
  return { default: MockAnthropic };
});
```

For tests that need to control the AI response per-test, use `vi.hoisted()`:

```typescript
const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => {
  class MockAnthropic { messages = { create: mockCreate }; }
  return { default: MockAnthropic };
});
// Then per test: mockCreate.mockResolvedValue(...)
```

### Pre-release gate (`npm run pre-release`)

The `scripts/pre-release.sh` script runs 8 checks in order and auto-fixes what it can:

| Step | Check | Auto-fix |
|---|---|---|
| 1 | `npm audit` — no High/Critical CVEs | `npm audit fix` attempted |
| 2 | Git history — no API key literals | None (manual rotation required) |
| 3 | `.env.local` not tracked by git | Adds `.env` patterns to `.gitignore` |
| 4 | `tsc --noEmit` — no TypeScript errors | None |
| 5 | ESLint — no errors | `eslint --fix` applied first |
| 6 | Security headers present in `next.config.ts` | None |
| 7 | SSRF guard present and all IP ranges covered | None |
| 8 | Full Vitest test suite passes | None |

Exits 0 only when all checks pass. Exits 1 with a summary of remaining issues.

### Known security fixes (2026-04)

**IPv6 loopback SSRF** — `isPrivateUrl()` in `app/api/vendor-description/route.ts`
originally checked `h === "::1"` but `new URL("http://[::1]").hostname` returns `"[::1]"`
(brackets included). Fixed to also check `h === "[::1]"`. Test in
`tests/api/vendor-description.test.ts → "blocks ::1 (IPv6 loopback)"` guards regression.

**`Permissions-Policy` header** — added to `next.config.ts` to disable camera, microphone,
geolocation, and payment APIs. Both the integration test and `pre-release.sh` verify its presence.

### ESLint notes

Next.js 16 ships `eslint-plugin-react-hooks` v7 which includes `react-hooks/purity`
(flags `Date.now()` in render) and `react-hooks/set-state-in-effect`. Legitimate uses in
`Topbar.tsx`, `Overview.tsx`, `Budget.tsx`, and `Research.tsx` are suppressed with
`// eslint-disable-line` inline comments rather than disabling the rule globally.
<!-- CLAUDE-EXTENSIONS-MERGE:START -->
## Deploy & infra (managed block — session-analysis additions, safe to edit)

Railway is the production host. See the `railway-deploy` skill for DNS, TXT records, Postgres wiring, and debug workflow. Before proposing any Railway fix, read the logs tail — do not guess.

### Skills to invoke automatically
- `railway-deploy` for any deploy or DNS work
- `nextjs-full-stack-bootstrap` patterns for new feature scaffolds
- `website-design` for any component styling
- `linear-ticket` for converting feedback to tickets

### Agents available
- `deployment-verifier` after every deploy
- `ui-polish-reviewer` before any prod push
- `feedback-to-linear` for inbound feedback

### Recurring bugs (do not re-introduce)
- Vendor card hover overlay misaligns when the status message opens — keep overlay positioned absolute to the card, not viewport.
- Vendors must auto-sort by name within each category.
- `class="empty"` is only valid on full-page empty state divs, never on inline field elements.
- Inbound vendor emails (Resend webhook at `/api/webhooks/resend`) must be excluded from Basic Auth middleware.

### Linear triage scheduled job
Runs every 30 min. Guard: only kickoff if an open ticket exists in a non-Review, non-Done state. This guard was added after the double-consulting-email incident.
<!-- CLAUDE-EXTENSIONS-MERGE:END -->
