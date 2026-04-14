/**
 * Inbound email webhook — receives email.received events from Resend.
 *
 * Setup (one-time, run once):
 *   curl -X POST https://api.resend.com/webhooks \
 *     -H "Authorization: Bearer <RESEND_API_KEY>" \
 *     -H "Content-Type: application/json" \
 *     -d '{"endpoint":"https://<your-app>/api/vendors/email?secret=<INBOUND_WEBHOOK_SECRET>","events":["email.received"]}'
 *
 * Then set env vars: INBOUND_WEBHOOK_SECRET, IMPORT_TOKEN, NEXT_PUBLIC_APP_URL, RESEND_API_KEY
 *
 * Usage: send any email containing vendor URLs to add@plan.louisjlevine.com
 * and the vendor is imported automatically.
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// ── Extract URLs from plain-text email body ───────────────────────────────────

function extractUrls(text: string): string[] {
  const seen = new Set<string>();
  const results: string[] = [];
  const matches = text.match(/https?:\/\/[^\s"'<>)\]]+/g) ?? [];
  for (const raw of matches) {
    const url = raw.replace(/[.,;!?]+$/, "");
    try {
      const parsed = new URL(url);
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
  return results.slice(0, 3);
}

// ── Fetch full email body from Resend API ─────────────────────────────────────

async function fetchEmailBody(emailId: string): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return "";
  try {
    const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return "";
    const data = await res.json() as { text?: string; html?: string; subject?: string };
    return `${data.subject ?? ""}\n${data.text ?? ""}`;
  } catch {
    return "";
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  const expected = process.env.INBOUND_WEBHOOK_SECRET;

  console.log(`[vendors/email] secret=${JSON.stringify(secret)} expected=${JSON.stringify(expected)} match=${secret === expected}`);
  if (!expected || !secret || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Handle Resend email.received event format
  const eventType = typeof body.type === "string" ? body.type : "";
  const data = (body.data ?? {}) as Record<string, unknown>;
  const emailId = typeof data.email_id === "string" ? data.email_id : "";
  const from = typeof data.from === "string" ? data.from : "";
  const subject = typeof data.subject === "string" ? data.subject : "";

  if (eventType !== "email.received" || !emailId) {
    console.log(`[vendors/email] Ignoring event: ${eventType}`);
    return NextResponse.json({ imported: 0, message: "Not an inbound email event" });
  }

  console.log(`[vendors/email] Received email from ${from}: "${subject}"`);

  // Fetch full email body (webhook payload only contains metadata)
  const fullText = await fetchEmailBody(emailId);
  console.log(`[vendors/email] emailId=${emailId} bodyLength=${fullText.length} subject="${subject}"`);
  console.log(`[vendors/email] body preview: ${fullText.slice(0, 200)}`);
  const urls = extractUrls(fullText || subject);
  console.log(`[vendors/email] extracted URLs: ${JSON.stringify(urls)}`);

  if (urls.length === 0) {
    console.log("[vendors/email] No vendor URLs found in email");
    return NextResponse.json({ imported: 0, message: "No URLs found" });
  }

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
        const resData = await res.json() as { vendor?: { name?: string } };
        results.push({ url, ok: true, name: resData.vendor?.name });
        console.log(`[vendors/email] Imported: ${resData.vendor?.name} (${url})`);
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
