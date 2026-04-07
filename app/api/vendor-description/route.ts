import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import type { WeddingAnswers, Vendor } from "@/lib/types";

export const dynamic = "force-dynamic";

// ── SSRF guard: block requests to private / internal addresses ────────────────

function isPrivateUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    if (url.protocol !== "https:" && url.protocol !== "http:") return true;
    const h = url.hostname;
    if (h === "localhost" || h === "::1") return true;
    if (/^127\./.test(h)) return true;
    if (/^10\./.test(h)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
    if (/^192\.168\./.test(h)) return true;
    if (/^169\.254\./.test(h)) return true;
    if (/^0\./.test(h)) return true;
    return false;
  } catch {
    return true; // unparseable URL → block
  }
}

// ── Fetch + strip a vendor website down to readable text ──────────────────────

async function scrapeWebsite(url: string): Promise<string> {
  if (isPrivateUrl(url)) return "";
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; wedding-planner-bot/1.0)",
        "Accept": "text/html",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return "";
    const html = await res.text();

    // Remove script/style/head blocks entirely
    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<head[\s\S]*?<\/head>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
      // Strip remaining tags, collapse whitespace
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&nbsp;/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#\d+;/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();

    // Return first ~3000 chars — enough for homepage copy without blowing the prompt
    return stripped.slice(0, 3000);
  } catch {
    return "";
  }
}

export async function POST(req: NextRequest) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const { vendor, answers } = await req.json() as { vendor: Vendor; answers: WeddingAnswers };

    // Fetch website content if available
    const websiteContent = vendor.website ? await scrapeWebsite(vendor.website) : "";

    const vendorLines = [
      `Name: ${vendor.name}`,
      `Category: ${vendor.category}`,
      vendor.website ? `Website: ${vendor.website}` : null,
      vendor.price   ? `Estimated price: $${vendor.price.toLocaleString()}` : null,
      vendor.notes   ? `Notes: ${vendor.notes}` : null,
    ].filter(Boolean).join("\n");

    const websiteSection = websiteContent
      ? `\nWebsite copy (scraped from their homepage):\n"""\n${websiteContent}\n"""`
      : "";

    const prompt = `You are helping a couple find wedding vendors similar to one they've been looking at.

Vendor details:
${vendorLines}${websiteSection}

Wedding context: ${answers.guestCount} guests, $${answers.budget?.toLocaleString()} budget, ${answers.vibe?.join("/")} vibe, ${answers.setting} setting, ${answers.location}.

Write 2–3 sentences that capture:
1. What makes this specific vendor distinctive — their actual tone, aesthetic, pricing philosophy, and included services (draw directly from the website copy if available, not generic assumptions)
2. What the couple should prioritise when searching for similar alternatives

Be specific and concrete. Mirror the vendor's actual personality and positioning — if they're casual and fun, say so; if they're luxury and formal, say that. Do not write generic venue advice.

Write only the description — no preamble, no labels, just the sentences.`;

    const message = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 350,
      messages: [{ role: "user", content: prompt }],
      system: "You are a wedding planning expert. Ground every description in the vendor's actual website copy and positioning. No generic filler.",
    });

    const description = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    return NextResponse.json({ description });
  } catch (error) {
    console.error("Vendor description error:", error);
    return NextResponse.json({ error: "Failed to generate description" }, { status: 500 });
  }
}
