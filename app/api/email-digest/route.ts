import { NextRequest, NextResponse } from "next/server";
import { buildDigest, sendViaResend, isValidDigestBody } from "@/lib/digest";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isValidDigestBody(body)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const digest = buildDigest(body);

  let sent = false;
  if (body.send) {
    const { emailPrefs } = body;
    const recipients: string[] = [];
    if (emailPrefs.optInLouis && emailPrefs.emailLouis) recipients.push(emailPrefs.emailLouis);
    if (emailPrefs.optInPartner && emailPrefs.emailPartner) recipients.push(emailPrefs.emailPartner);

    if (recipients.length > 0) {
      sent = await sendViaResend(recipients, digest.subject, digest.html, digest.plainText);
    }
  }

  return NextResponse.json({
    subject: digest.subject,
    plainText: digest.plainText,
    html: digest.html,
    stats: digest.stats,
    sent,
    resendConfigured: !!process.env.RESEND_API_KEY,
  });
}
