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