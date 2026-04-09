import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  notes: z.string().min(1).max(5000),
  vendorName: z.string().min(1).max(200),
  category: z.string().min(1).max(100),
});

export async function POST(req: NextRequest) {
  const parseResult = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parseResult.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { notes, vendorName, category } = parseResult.data;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: `You clean up and normalize vendor notes for a wedding planner app. Fix grammar, spelling, and punctuation. Organize scattered thoughts into clear, concise bullet points or short paragraphs. Preserve all factual details — prices, dates, names, measurements, and specifics. Do not add information that wasn't in the original. Do not add greetings or sign-offs. Return only the cleaned-up notes text.`,
      messages: [
        {
          role: "user",
          content: `Clean up these notes for ${vendorName} (${category}):\n\n${notes}`,
        },
      ],
    });

    const cleaned =
      response.content[0].type === "text" ? response.content[0].text.trim() : notes;

    return NextResponse.json({ cleaned });
  } catch (error) {
    console.error("[cleanup-notes] Error:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: "Failed to clean up notes" },
      { status: 500 }
    );
  }
}
