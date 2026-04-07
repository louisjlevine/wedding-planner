import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import type { WeddingAnswers, ResearchRecommendation } from "@/lib/types";
import type { ResearchType } from "@/lib/research-prompts";

export const dynamic = "force-dynamic";

const VALID_RESEARCH_TYPES = new Set<ResearchType>([
  "venue", "photographer", "caterer", "florist", "music",
  "dress", "honeymoon", "timeline", "budget",
]);

export async function POST(req: NextRequest) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const body = await req.json();
    const { messages, recommendations, notes, type, answers } = body as {
      messages: Array<{ role: "user" | "assistant"; content: string }>;
      recommendations: ResearchRecommendation[];
      notes: string;
      type: ResearchType;
      answers: WeddingAnswers;
    };

    if (!type || !VALID_RESEARCH_TYPES.has(type) || !answers || typeof answers !== "object") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const recContext =
      recommendations.length > 0
        ? recommendations
            .map((r, i) => `${i + 1}. **${r.title}** — ${r.description} (${r.priceRange ?? "price varies"})${r.website ? ` — ${r.website}` : ""}\n   Why it fits: ${r.why}`)
            .join("\n")
        : "No recommendations generated yet.";

    const systemPrompt = `You are an expert wedding planner assistant helping Louis & ${answers.partnerName || "their partner"} dig deeper into their ${type} planning.

Wedding context:
- Date: ${answers.date} | Location: ${answers.location}
- Guests: ${answers.guestCount} | Budget: $${answers.budget?.toLocaleString()}
- Priorities: ${answers.priorities?.join(", ")} | Setting: ${answers.setting}
${notes?.trim() ? `\nCouple's notes: ${notes}` : ""}

Current recommendations on the table:
${recContext}

Answer follow-up questions concisely and practically. Reference specific recommendations by name when relevant. Use **bold**, bullet lists, and ## headers in your responses. Be direct — no filler.`;

    const stream = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 800,
      system: systemPrompt,
      messages,
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
              controller.enqueue(encoder.encode(chunk.delta.text));
            }
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
    });
  } catch (error) {
    console.error("Research chat error:", error);
    return new Response("Failed to get response", { status: 500 });
  }
}
