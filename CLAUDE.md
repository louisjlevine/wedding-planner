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
partner name (free text), date (single), location (single), guests (single), 
budget (single), vibe (multi), priorities (multi, pick 3), setting (single), 
funding (single), stress (multi)

## Adaptive rules (plan-adapters.ts must implement these)
- outdoor setting → add tent/weather contingency tasks + flag in timeline
- photography priority → boost photo budget % by 5, note in tips
- food priority → boost catering budget % by 5
- mountain location → add "book early, venues fill 18mo out" warning
- under 50 guests → mark venue booking as "easier, more flexibility"
- 100k+ budget → unlock luxury vendor tier notes in research prompts

## Security

### Post-deployment security scan (required after every major deployment)

After every major deployment, perform a security scan covering the following and resolve any findings before the next release:

1. **Secrets / API keys** — confirm `.env*` files are gitignored and no secrets appear in git history (`git log -p | grep -i "sk-ant\|api_key\|secret"`). Revoke and rotate any exposed keys immediately.

2. **SSRF in vendor-description route** — `app/api/vendor-description/route.ts` fetches user-supplied URLs. Validate that private IP ranges (`127.x`, `10.x`, `172.16-31.x`, `192.168.x`, `169.254.x`, `::1`) and `localhost` are blocked before each fetch.

3. **Input validation on all API routes** — every route must reject unrecognised `type` values and malformed payloads with a 400 before passing data to Anthropic. Use `zod` for schema validation.

4. **Authentication / CSRF** — all `/api/*` routes must verify the request originates from the app (session cookie, CSRF token, or signed token). No unauthenticated calls to Anthropic should be possible from an external origin.

5. **Rate limiting** — `/api/research`, `/api/advisor`, `/api/research-chat`, `/api/recommendations`, and `/api/vendor-description` must enforce a per-IP rate limit to prevent cost-explosion attacks. Target: ≤ 20 AI calls / hour / IP.

6. **Security headers** — `next.config.ts` must set `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, and `Referrer-Policy` on all responses.

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