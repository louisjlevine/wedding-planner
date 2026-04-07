import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { buildResearchPrompt, ResearchType } from "@/lib/research-prompts";
import type { WeddingAnswers } from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID_RESEARCH_TYPES = new Set<ResearchType>([
  "venue", "photographer", "caterer", "florist", "music",
  "dress", "honeymoon", "timeline", "budget",
]);

export async function POST(req: NextRequest) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const body = await req.json();
    const { type, answers } = body as {
      type: ResearchType;
      answers: WeddingAnswers;
    };

    if (!type || !VALID_RESEARCH_TYPES.has(type) || !answers || typeof answers !== "object") {
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400 }
      );
    }

    const prompt = buildResearchPrompt(type, answers);

    const message = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      system:
        "You are an expert wedding planner with 15 years of experience. Provide detailed, practical, and actionable advice. Be warm but professional. Format responses with clear sections using markdown-style headers.",
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";

    return NextResponse.json({ result: text });
  } catch (error) {
    console.error("Research API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch research" },
      { status: 500 }
    );
  }
}
