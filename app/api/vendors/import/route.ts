import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

// ── SSRF guard ────────────────────────────────────────────────────────────────

function isPrivateUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    if (url.protocol !== "https:" && url.protocol !== "http:") return true;
    const h = url.hostname;
    if (h === "localhost" || h === "::1" || h === "[::1]") return true;
    if (/^127\./.test(h)) return true;
    if (/^10\./.test(h)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
    if (/^192\.168\./.test(h)) return true;
    if (/^169\.254\./.test(h)) return true;
    if (/^0\./.test(h)) return true;
    return false;
  } catch {
    return true;
  }
}

// ── Website scraper ───────────────────────────────────────────────────────────

async function scrapeWebsite(url: string): Promise<string> {
  if (isPrivateUrl(url)) return "";
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; wedding-planner-bot/1.0)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return "";
    const html = await res.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<head[\s\S]*?<\/head>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&nbsp;/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#\d+;/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim()
      .slice(0, 4000);
  } catch {
    return "";
  }
}

// ── Postgres helpers (same pattern as /api/sync) ──────────────────────────────

let pool: Pool | null = null;
function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes("railway")
        ? { rejectUnauthorized: false }
        : false,
    });
  }
  return pool;
}

async function readState(): Promise<Record<string, unknown>> {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS plan_state (
      id   INTEGER PRIMARY KEY DEFAULT 1,
      data JSONB   NOT NULL,
      CHECK (id = 1)
    )
  `);
  const result = await getPool().query(
    "SELECT data FROM plan_state WHERE id = 1"
  );
  return result.rows.length > 0
    ? (result.rows[0].data as Record<string, unknown>)
    : {};
}

async function writeState(state: Record<string, unknown>): Promise<void> {
  await getPool().query(
    `INSERT INTO plan_state (id, data) VALUES (1, $1)
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
    [state]
  );
}

// ── Auth ──────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  // Session cookie (browser)
  const cookie = req.cookies.get("session")?.value;
  if (cookie && process.env.SESSION_TOKEN && cookie === process.env.SESSION_TOKEN)
    return true;
  // Bearer token (iOS Shortcut / external callers)
  const auth = req.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    if (token && process.env.IMPORT_TOKEN && token === process.env.IMPORT_TOKEN)
      return true;
  }
  return false;
}

// ── Valid categories ──────────────────────────────────────────────────────────

const VALID_CATEGORIES = [
  "Venue", "Photography", "Catering", "Florist", "Music",
  "Attire", "Hair & Makeup", "Transport", "Stationery", "Other",
];

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let url: string;
  try {
    const body = await req.json();
    if (typeof body.url !== "string" || !body.url.trim()) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }
    url = body.url.trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (isPrivateUrl(url)) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const pageContent = await scrapeWebsite(url);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `You are extracting wedding vendor info from a website for a wedding planning app.

URL: ${url}

Website content:
"""
${pageContent || "(could not fetch page content — infer from URL only)"}
"""

Return ONLY a valid JSON object — no markdown fences, no explanation:
{
  "name": "business name",
  "category": "one of: Venue, Photography, Catering, Florist, Music, Attire, Hair & Makeup, Transport, Stationery, Other",
  "contact": "email or phone if clearly visible, otherwise null",
  "price": integer starting price in USD (no $ or commas), or null,
  "notes": "1–2 sentences on their style, specialty, and what makes them distinctive"
}

Rules:
- name: the actual business name, not a description
- category: best single match from the list
- contact: prefer email over phone; null if absent
- price: lowest package / starting-from price as plain integer; null if not found
- notes: concrete and specific, grounded in their site copy`;

  type Extracted = {
    name: string;
    category: string;
    contact: string | null;
    price: number | null;
    notes: string;
  };

  let extracted: Extracted;
  try {
    const message = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });
    const raw =
      message.content[0].type === "text" ? message.content[0].text.trim() : "{}";
    const jsonText = raw
      .replace(/^```(?:json)?\n?/, "")
      .replace(/\n?```$/, "");
    extracted = JSON.parse(jsonText);
  } catch {
    const hostname = (() => {
      try {
        return new URL(url).hostname.replace(/^www\./, "");
      } catch {
        return url;
      }
    })();
    extracted = { name: hostname, category: "Other", contact: null, price: null, notes: "" };
  }

  if (!VALID_CATEGORIES.includes(extracted.category)) {
    extracted.category = "Other";
  }

  // ── Domain matching: find existing vendor with same hostname ─────────────────

  function extractDomain(u: string): string {
    try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; }
  }

  const incomingDomain = extractDomain(url);

  const newNote = extracted.notes
    ? { id: `note-${Date.now()}`, text: extracted.notes, addedAt: new Date().toISOString() }
    : null;

  try {
    const state = await readState();
    const vendors = Array.isArray(state.vendors) ? (state.vendors as Record<string, unknown>[]) : [];

    // Try to find an existing vendor whose website shares the same domain
    const matchIndex = incomingDomain
      ? vendors.findIndex((v) => typeof v.website === "string" && extractDomain(v.website) === incomingDomain)
      : -1;

    if (matchIndex >= 0) {
      // Merge into existing vendor: add note, backfill missing contact/price
      const existing = vendors[matchIndex] as Record<string, unknown>;
      const existingNotes = Array.isArray(existing.notesList) ? existing.notesList : [];
      const updated = {
        ...existing,
        notesList: newNote ? [...existingNotes, newNote] : existingNotes,
        // Backfill contact and price only if not already set
        contact: existing.contact ?? (extracted.contact || undefined),
        price: existing.price ?? (typeof extracted.price === "number" ? Math.round(extracted.price) : undefined),
      };
      const updatedVendors = vendors.map((v, i) => (i === matchIndex ? updated : v));
      await writeState({ ...state, vendors: updatedVendors });
      return NextResponse.json({ vendor: updated, matched: true });
    }

    // No match — create a new vendor
    const vendor = {
      id: `vendor-${Date.now()}`,
      category: extracted.category,
      name: extracted.name || new URL(url).hostname,
      contact: extracted.contact ?? undefined,
      website: url,
      price: typeof extracted.price === "number" ? Math.round(extracted.price) : undefined,
      notesList: newNote ? [newNote] : [],
      status: "considering" as const,
    };
    await writeState({ ...state, vendors: [...vendors, vendor] });
    return NextResponse.json({ vendor, matched: false });
  } catch (err) {
    console.error("[vendors/import] DB write failed:", err);
    return NextResponse.json({ error: "Failed to save vendor" }, { status: 500 });
  }
}
