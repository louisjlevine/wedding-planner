import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import type { WeddingAnswers, ResearchRecommendation } from "@/lib/types";
import type { ResearchType } from "@/lib/research-prompts";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  venue: "wedding venues",
  photographer: "wedding photographers",
  caterer: "wedding caterers",
  florist: "wedding florists / floral designers",
  music: "wedding bands or DJs",
  dress: "bridal boutiques or dress designers",
  honeymoon: "honeymoon destinations or travel agents",
  timeline: "wedding day timeline templates",
  budget: "budget planning guidance",
};

function parseJsonArray(raw: string): Record<string, string>[] | null {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? raw.match(/(\[[\s\S]*\])/);
    if (match) {
      try {
        const parsed = JSON.parse(match[1]);
        return Array.isArray(parsed) ? parsed : null;
      } catch { return null; }
    }
    return null;
  }
}

export async function POST(req: NextRequest) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const body = await req.json();
    const { type, notes, answers } = body as {
      type: ResearchType;
      notes: string;
      answers: WeddingAnswers;
    };

    const label = TYPE_LABELS[type] ?? type;
    const isLuxury = answers.budget >= 100_000;

    const prompt = `You are an expert wedding planner recommending ${label} for Louis & ${answers.partnerName || "their partner"}.

Wedding details:
- Date: ${answers.date} (${answers.location})
- Guests: ${answers.guestCount} | Budget: $${answers.budget?.toLocaleString()}${isLuxury ? " (luxury)" : ""}
- Vibe: ${answers.vibe?.join(", ")}
- Priorities: ${answers.priorities?.join(", ")}
- Setting: ${answers.setting}
${notes?.trim() ? `\nAdditional notes from the couple:\n${notes}` : ""}

Provide exactly 10 specific, tailored recommendations for ${label}. Use real business names, real price ranges, and real websites. Only recommend businesses you are confident are real and established.

Return ONLY a valid JSON array with no other text. Each object must have exactly these fields:
- "title": business name (string)
- "description": 1–2 sentence description (string)
- "priceRange": typical price range e.g. "$3,000–$6,000" (string, can be "Varies")
- "website": full URL starting with https:// (string, use "" if unknown)
- "why": 1 sentence explaining why it fits their specific wedding (string)
- "status": your best assessment of whether this business is still operating — use "open" if you are confident it is currently active, "closed" if you know it has shut down, or "unknown" if you are not sure (string)

Example:
[{"title":"Example Venue","description":"A beautiful space.","priceRange":"$5,000–$10,000","website":"https://example.com","why":"Matches your vibe.","status":"open"}]`;

    const message = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 3500,
      messages: [{ role: "user", content: prompt }],
      system: "You are a wedding planning expert. Return only valid JSON arrays — no markdown, no explanation, no code blocks. Just the raw JSON.",
    });

    const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    const parsed = parseJsonArray(raw);

    if (!parsed) {
      return NextResponse.json({ error: "Failed to parse recommendations" }, { status: 500 });
    }

    const recommendations: ResearchRecommendation[] = parsed.map((r, i) => {
      const rawStatus = (r.status ?? "").toLowerCase();
      const status: ResearchRecommendation["status"] =
        rawStatus === "open" ? "open" : rawStatus === "closed" ? "closed" : "unknown";
      return {
        id: `rec-${Date.now()}-${i}`,
        title:       r.title       ?? "Untitled",
        description: r.description ?? "",
        priceRange:  r.priceRange  || undefined,
        website:     r.website     || undefined,
        why:         r.why         ?? "",
        status,
        statusNote:  status !== "unknown" ? "Based on AI training data — verify before booking" : undefined,
      };
    });

    return NextResponse.json({ recommendations });
  } catch (error) {
    console.error("Recommendations API error:", error);
    return NextResponse.json({ error: "Failed to get recommendations" }, { status: 500 });
  }
}
