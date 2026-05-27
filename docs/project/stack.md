# Tech Stack

**Do not add dependencies not listed here without routing through the `cto` agent first.**

- **Language:** TypeScript (strict)
- **Framework:** Next.js 14+ (App Router, React Server Components where possible)
- **State:** Zustand + `persist` middleware → localStorage. Store in `lib/plan-store.ts`.
- **Styling:** Tailwind CSS only — no inline styles. Pink accent `#D4537E` for CTAs and active states.
- **AI:** `@anthropic-ai/sdk` (server-side only, never in client components or browser)
- **Validation:** `zod` on all API routes
- **HTTP:** Native `fetch` (Next.js routes); `httpx` not applicable
- **Auth:** Session cookie (`session` cookie, `SESSION_SECRET` env var), checked in `middleware.ts`
- **Email:** Resend (`resend` package) for digest emails
- **Testing:** Vitest + `@testing-library/react` for components

## LLM model choices

Keep all Anthropic SDK usage in the relevant `app/api/*/route.ts` files. No LLM calls in `lib/` or components.

- **`claude-haiku-4-5-20251001`** — relevance scoring, short classification, cheap tasks
- **`claude-sonnet-4-6`** — richer responses, advisor chat, research notes

Never call the LLM inside a loop without rate-limiting. All AI routes enforce ≤ 20 calls / hour / IP via `middleware.ts`.

## Commands (agents read these)

- **Test:** `npm test`
- **Test (watch):** `npm run test:watch`
- **Test (coverage):** `npm run test:coverage`
- **Pre-release gate:** `npm run pre-release`
- **Dep audit:** `npm audit --audit-level=high`
- **Lint:** `npm run lint`
- **Typecheck:** `npx tsc --noEmit`
- **Test file naming:** `tests/<layer>/<module>.test.ts` — e.g. `tests/api/research.test.ts`, `tests/unit/adapters.test.ts`

## Coding Conventions (apply project-wide)

- All API routes must validate with `zod` and return `400` for bad input before touching Anthropic.
- No Anthropic SDK calls in client components or `lib/` — API routes only.
- Zustand store mutations go in `lib/plan-store.ts`; derived data (timeline, budget categories, tasks) live in `lib/plan-adapters.ts`.
- Tailwind only — no `style={{}}` props, no CSS modules.
- Type-annotate all function signatures.
- Use Vitest + class-based mocks for `@anthropic-ai/sdk` (arrow functions can't be `new`-ed).
- Do not commit `.env.local` or `data/`.
- No `console.log` in production code (use `console.error` only for actual errors in API routes).
- `pre` tag with `className="whitespace-pre-wrap"` inside `ResearchCard` for AI text output.
