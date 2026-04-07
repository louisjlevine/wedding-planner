import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  feedback: z.string().min(1).max(2000),
});

const LINEAR_API = "https://api.linear.app/graphql";
const LINEAR_TEAM_ID = "a97e2f10-88d5-4d48-bfab-ad0e9a853b1e";

// Priority map: Claude returns a string, we map to Linear's int (0=none,1=urgent,2=high,3=normal,4=low)
const PRIORITY_MAP: Record<string, number> = {
  urgent: 1,
  high: 2,
  normal: 3,
  low: 4,
};

async function createLinearIssue(
  title: string,
  description: string,
  priority: number
): Promise<string> {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) throw new Error("LINEAR_API_KEY not configured");

  const mutation = `
    mutation CreateIssue($title: String!, $description: String!, $teamId: String!, $priority: Int!) {
      issueCreate(input: {
        title: $title,
        description: $description,
        teamId: $teamId,
        priority: $priority
      }) {
        success
        issue { id identifier url }
      }
    }
  `;

  const res = await fetch(LINEAR_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Personal API keys use the key directly; OAuth tokens use Bearer
      Authorization: apiKey.startsWith("lin_oauth_") ? `Bearer ${apiKey}` : `${apiKey}`,
    },
    body: JSON.stringify({
      query: mutation,
      variables: { title, description, teamId: LINEAR_TEAM_ID, priority },
    }),
  });

  const body = await res.text();
  if (!res.ok) {
    console.error(`[feedback] Linear HTTP ${res.status}:`, body);
    throw new Error(`Linear API error: ${res.status}`);
  }

  let json: { data?: { issueCreate?: { success?: boolean; issue?: { url?: string } } }; errors?: unknown };
  try {
    json = JSON.parse(body);
  } catch {
    console.error("[feedback] Linear non-JSON response:", body);
    throw new Error("Linear returned non-JSON");
  }

  if (json.errors) {
    console.error("[feedback] Linear GraphQL errors:", JSON.stringify(json.errors));
  }

  if (!json.data?.issueCreate?.success) {
    console.error("[feedback] Linear issueCreate not successful:", JSON.stringify(json));
    throw new Error("Linear issue creation failed");
  }

  return json.data.issueCreate.issue?.url ?? "";
}

export async function POST(req: NextRequest) {
  const parseResult = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parseResult.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { feedback } = parseResult.data;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    // Use Claude to diagnose and structure the feedback into a Linear issue
    console.log("[feedback] Calling Claude to structure feedback");
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: `You are a product manager triaging user feedback for a wedding planning app.
Given raw feedback, produce a structured issue in valid JSON only — no extra text.

Return exactly this shape:
{
  "title": "<short, specific issue title under 80 chars>",
  "description": "<markdown description with: ## Summary, ## Steps to Reproduce (if applicable), ## Expected vs Actual, ## Impact>",
  "priority": "urgent" | "high" | "normal" | "low"
}

Priority guide:
- urgent: app is broken / unusable for core flows
- high: significant friction, data loss risk, or confusing UX
- normal: minor bug, small UX improvement
- low: polish, cosmetic, nice-to-have`,
      messages: [
        {
          role: "user",
          content: `User feedback:\n\n${feedback}`,
        },
      ],
    });

    const raw =
      response.content[0].type === "text" ? response.content[0].text : "";

    let title: string;
    let description: string;
    let priorityStr: string;

    try {
      // Strip any markdown code fences if present
      const cleaned = raw.replace(/^```[a-z]*\n?/i, "").replace(/```$/, "").trim();
      const parsed = JSON.parse(cleaned);
      title = parsed.title ?? "User Feedback";
      description = parsed.description ?? feedback;
      priorityStr = parsed.priority ?? "normal";
    } catch {
      // Fallback: use raw feedback directly
      title = feedback.slice(0, 80);
      description = `## Summary\n\n${feedback}`;
      priorityStr = "normal";
    }

    const priority = PRIORITY_MAP[priorityStr] ?? 3;

    const fullDescription = `${description}\n\n---\n\n**Original feedback:**\n> ${feedback}`;

    console.log("[feedback] Creating Linear issue:", title, "priority:", priority);
    const issueUrl = await createLinearIssue(title, fullDescription, priority);
    console.log("[feedback] Issue created:", issueUrl);

    return NextResponse.json({ ok: true, issueUrl });
  } catch (error) {
    console.error("[feedback] Error:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: "Failed to submit feedback" },
      { status: 500 }
    );
  }
}
