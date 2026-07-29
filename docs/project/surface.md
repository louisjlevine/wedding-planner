# Surface Area

## Web UI (agents read these)

Next.js App Router app.

- **Dev server:** `npm run dev` → `http://localhost:3000`
- **Base URL (local):** `http://localhost:3000`
- **App dir:** `app/` (routes, layouts, page.tsx files)
- **Components dir:** `components/` (sections/, shell/, ui/)
- **Styles:** `app/globals.css` (Tailwind base), no CSS modules
- **Web test file pattern:** `tests/**/*.test.ts`

### Pages / Routes

| Route | File | Notes |
|---|---|---|
| `/` | `app/page.tsx` | Redirects to `/planner` if authed |
| `/login` | `app/login/page.tsx` | Session-cookie auth |
| `/planner` | `app/planner/page.tsx` | Main SPA shell |

### Components

```
components/
├── sections/
│   ├── Intake.tsx          # 10-question intake wizard — drives everything
│   ├── Overview.tsx        # Dashboard with key metrics
│   ├── Timeline.tsx        # Combined milestones + tasks on one page
│   ├── Budget.tsx          # Budget categories + spend tracking
│   ├── Vendors.tsx         # Vendor CRUD + notes/attachments
│   ├── Compare.tsx         # Side-by-side venue cost comparison
│   ├── Guests.tsx          # Guest list + RSVP tracking
│   ├── Research.tsx        # Research cards per category
│   ├── Advisor.tsx         # Streaming AI chat
│   └── DigestSettings.tsx  # Email digest configuration
├── shell/
│   ├── Layout.tsx          # Top-level layout with sidebar
│   ├── Sidebar.tsx         # Tab navigation
│   └── Topbar.tsx          # Header with date / status
└── ui/
    ├── Badge.tsx
    ├── BudgetBar.tsx
    ├── EditableMoneyCell.tsx
    ├── FeedbackWidget.tsx
    ├── MetricCard.tsx
    ├── MiscLineItemsEditor.tsx
    ├── Panel.tsx
    └── ResearchCard.tsx
```

## API Routes

All routes require session-cookie auth (enforced in `middleware.ts`). All validate with `zod` and return `400` for bad input.

| Route | Method | Purpose | Rate-limited |
|---|---|---|---|
| `/api/advisor` | POST | Streaming advisor chat | Yes |
| `/api/research` | POST | Research notes + recommendations | Yes |
| `/api/research-chat` | POST | Per-type research follow-up chat | Yes |
| `/api/recommendations` | POST | Vendor recommendations | Yes |
| `/api/vendor-description` | POST | Fetch vendor website + summarise | Yes |
| `/api/vendors/import` | POST | Bulk vendor import | No |
| `/api/vendors/email` | POST | Send vendor email via Resend | No |
| `/api/vendors/cleanup-notes` | POST | AI-cleanup of legacy vendor notes | No |
| `/api/feedback` | POST | User feedback submission | No |
| `/api/email-digest` | POST | Send weekly digest | No |
| `/api/email-digest/cron` | GET | Railway cron trigger for digest | No |
| `/api/sync` | GET / POST | Server-side plan sync (optional) | No |
| `/api/sync/debug` | GET | Sync debug info | No |
| `/api/auth/login` | POST | Issue session cookie | No |
| `/api/auth/logout` | POST | Clear session cookie | No |

## Environment Variables

```
ANTHROPIC_API_KEY=          # required for all AI features
SESSION_SECRET=             # required — signs the session cookie
RESEND_API_KEY=             # optional, for email digest
NEXT_PUBLIC_APP_URL=        # production base URL (for CORS)
DATABASE_URL=               # optional server sync (Vercel KV or similar)
```

## Middleware (`middleware.ts`)

- Blocks bots by User-Agent
- Enforces session cookie on all `/api/*` routes (except `/api/auth/*`)
- Applies per-IP rate limiting on AI routes
- Sets CORS `Access-Control-Allow-Origin` to own origin only
