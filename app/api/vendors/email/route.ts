/**
 * Inbound email webhook — receives emails forwarded via Resend Inbound Routing.
 *
 * Setup (one-time):
 * 1. In Resend dashboard → Domains → your domain → Inbound Routing
 * 2. Add rule: deliver to (catch-all or specific address) → webhook
 * 3. Webhook URL: https://your-domain.com/api/vendors/email?secret=<INBOUND_WEBHOOK_SECRET>
 * 4. Set INBOUND_WEBHOOK_SECRET in your env vars (any random string, 32+ chars)
 *
 * Usage: forward any vendor email — or send a message containing their URL — to
 * your designated address and the vendor is imported automatically.
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// ── Extract URLs from plain-text email body ───────────────────────────────────

function extractUrls(text: string): string[] {
  const seen = new Set<string>();
  const results: string[] = [];
  // Match http(s):// URLs
  const matches = text.match(/https?:\/\/[^\s"'<>)\]]+/g) ?? [];
  for (const raw of matches) {
    // Trim trailing punctuation that may have been included
    const url = raw.replace(/[.,;!?]+$/, "");
    try {
      const parsed = new URL(url);
      // Skip common non-vendor domains
      const skip = [
        "mailto:", "unsubscribe", "tracking", "click.", "open.",
        "resend.com", "sendgrid", "mailchimp", "constantcontact",
      ];
      if (skip.some((s) => url.includes(s))) continue;
      const key = parsed.hostname + parsed.pathname;
      if (!seen.has(key)) {
        seen.add(key);
        results.push(url);
      }
    } catch {
      continue;
    }
  }
  // Limit to first 3 to avoid runaway API usage
  return results.slice(0, 3);
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Verify webhook secret from query param (set in Resend dashboard webhook URL)
  const secret = req.nextUrl.searchParams.get("secret");
  const expected = process.env.INBOUND_WEBHOOK_SECRET;

  if (!expected || !secret || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Resend inbound email fields
  const text =
    typeof body.text === "string" ? body.text :
    typeof body.plain === "string" ? body.plain : "";

  const subject = typeof body.subject === "string" ? body.subject : "";
  const from = typeof body.from === "string" ? body.from : "";

  console.log(`[vendors/email] Received email from ${from}: "${subject}"`);

  // Combine subject + body to catch URLs wherever they appear
  const fullText = `${subject}\n${text}`;
  const urls = extractUrls(fullText);

  if (urls.length === 0) {
    console.log("[vendors/email] No vendor URLs found in email");
    return NextResponse.json({ imported: 0, message: "No URLs found" });
  }

  // Call the import endpoint for each URL (internal call using IMPORT_TOKEN)
  const importToken = process.env.IMPORT_TOKEN;
  if (!importToken) {
    console.error("[vendors/email] IMPORT_TOKEN not configured");
    return NextResponse.json({ error: "Import not configured" }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const results: Array<{ url: string; ok: boolean; name?: string }> = [];

  for (const url of urls) {
    try {
      const res = await fetch(`${appUrl}/api/vendors/import`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${importToken}`,
        },
        body: JSON.stringify({ url }),
      });
      if (res.ok) {
        const data = await res.json() as { vendor?: { name?: string } };
        results.push({ url, ok: true, name: data.vendor?.name });
        console.log(`[vendors/email] Imported: ${data.vendor?.name} (${url})`);
      } else {
        results.push({ url, ok: false });
        console.warn(`[vendors/email] Import failed for ${url}: ${res.status}`);
      }
    } catch (err) {
      results.push({ url, ok: false });
      console.error(`[vendors/email] Import error for ${url}:`, err);
    }
  }

  const imported = results.filter((r) => r.ok).length;
  return NextResponse.json({ imported, results });
}
