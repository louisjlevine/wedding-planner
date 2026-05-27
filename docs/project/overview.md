# Project Overview

A collaborative wedding planning app for Louis & partner. Built in Next.js (App Router). All AI calls go through Next.js API routes — never client-side.

## Core Features

### 1. Intake Questionnaire
- Ten questions collected in order: partner name, date, location, guest count, budget, vibe (multi), priorities (pick 3), setting, funding, stress sources
- Drives all derived planning outputs via `lib/plan-adapters.ts`

### 2. Overview + Planning Dashboard
- Timeline: derived milestones, sorted by months-before, with outdoor/mountain adaptive flags
- Budget: percentage-based categories with adaptive boosts (photography +5%, food +5% for priority selections)
- Tasks: generated from answers, with priority + due date

### 3. Vendor Tracking
- Categories: venue, catering, photography, music, florist, etc.
- Status: considering → contacted → booked / rejected
- Notes (append-only list), attachments (base64), cost model (venue hours + overtime, per-person, misc line items)
- Compare dashboard: side-by-side venue cost comparison with caterer + bar config

### 4. Guest Management
- Name, email, address, RSVP status, dietary, table, relationship strength, priority (must / want / ifSpace)
- Probability-based attendance estimation (`lib/guest-probability.ts`)

### 5. Research Tab
- Type-keyed research cards; each type maps to a context-aware prompt in `lib/research-prompts.ts`
- Calls `/api/research` (non-streaming) → returns notes + vendor recommendations
- Per-type chat via `/api/research-chat`

### 6. Advisor Tab
- Streaming chat via `/api/advisor`
- Conversation history persisted in Zustand store

### 7. Digest
- Weekly email digest to Louis + partner via `/api/email-digest`
- Configurable preferences (email addresses, day of week, opt-in flags)

## Adaptive Rules (`lib/plan-adapters.ts`)
- outdoor setting → tent/weather contingency tasks + timeline flag
- photography priority → +5% photo budget, tip note
- food priority → +5% catering budget
- mountain location → "book early, venues fill 18mo out" warning
- under 50 guests → venue booking flagged as "easier, more flexibility"
- 100k+ budget → luxury vendor tier notes unlocked in research prompts

## Out of Scope (for now)
- Mobile app
- Multi-user / cloud sync (server sync exists as an optional feature)
- Calendar integration
- Email / Gmail sync
