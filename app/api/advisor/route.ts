import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import type { WeddingAnswers } from "@/lib/types";
import { describeWeddingDateForPrompt } from "@/lib/date-utils";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const body = await req.json();
    const {
      messages,
      answers,
    }: {
      messages: Array<{ role: "user" | "assistant"; content: string }>;
      answers: WeddingAnswers | null;
    } = body;

    const context = answers
      ? `
Wedding context for ${answers.partnerName ? `Louis & ${answers.partnerName}` : "this couple"}:
- Date: ${describeWeddingDateForPrompt(answers)}
- Location: ${answers.location}
- Guests: ${answers.guestCount}
- Budget: $${answers.budget?.toLocaleString() ?? "TBD"}
- Vibe: ${answers.vibe?.join(", ")}
- Priorities: ${answers.priorities?.join(", ")}
- Setting: ${answers.setting}
`.trim()
      : "No wedding details provided yet.";

    const systemPrompt = `You are a warm, expert wedding planner assistant for Louis and their partner. You have 15 years of experience planning weddings across all budgets and styles.

${context}

Be conversational, practical, and encouraging. Give specific advice tailored to their details. Keep responses focused and actionable. When relevant, reference their specific budget, location, or preferences.

Format your responses with clean markdown: use ## for section headers, **bold** for emphasis, and bullet lists where helpful. Do not use horizontal rules (---). Keep responses concise.`;

    const stream = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1000,
      system: systemPrompt,
      messages,
      stream: true,
    });

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (
              chunk.type === "content_block_delta" &&
              chunk.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(chunk.delta.text));
            }
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Advisor API error:", error);
    return new Response("Failed to get advisor response", { status: 500 });
  }
}
