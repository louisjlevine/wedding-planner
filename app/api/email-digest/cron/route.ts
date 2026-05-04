import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { buildTimeline, buildBudgetCategories, buildInitialTasks } from "@/lib/plan-adapters";
import { buildDigest, sendViaResend } from "@/lib/digest";
import type { EmailDigestPrefs, WeddingAnswers, Vendor, Task } from "@/lib/types";

export const dynamic = "force-dynamic";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes("railway")
        ? { rejectUnauthorized: false }
        : false,
    });
  }
  return pool;
}

export async function GET(req: NextRequest) {
  // Verify Vercel cron secret (set CRON_SECRET in env to secure this endpoint)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Read plan state from DB
  let planState: Record<string, unknown>;
  try {
    const result = await getPool().query("SELECT data FROM plan_state WHERE id = 1");
    if (result.rows.length === 0) {
      return NextResponse.json({ skipped: true, reason: "no plan data" });
    }
    planState = result.rows[0].data as Record<string, unknown>;
  } catch (err) {
    console.error("[email-digest/cron] DB read failed:", err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  const emailPrefs = planState.emailPrefs as EmailDigestPrefs | null;
  if (!emailPrefs) {
    return NextResponse.json({ skipped: true, reason: "no email prefs" });
  }

  const hasRecipient =
    (emailPrefs.optInLouis && emailPrefs.emailLouis) ||
    (emailPrefs.optInPartner && emailPrefs.emailPartner);
  if (!hasRecipient) {
    return NextResponse.json({ skipped: true, reason: "no opted-in recipients" });
  }

  // Only send on the preferred day of the week (0 = Sunday, 6 = Saturday)
  const todayDay = new Date().getDay();
  if (todayDay !== emailPrefs.sendDay) {
    return NextResponse.json({
      skipped: true,
      reason: `today is day ${todayDay}, sendDay is ${emailPrefs.sendDay}`,
    });
  }

  const answers = planState.answers as WeddingAnswers | null;
  if (!answers) {
    return NextResponse.json({ skipped: true, reason: "no answers" });
  }

  // Reconstruct derived plan data (mirrors usePlan hook logic)
  const timelineDoneIds = (planState.timelineDoneIds as string[] | undefined) ?? [];
  const doneSet = new Set(timelineDoneIds);
  const timeline = buildTimeline(answers).map((item) =>
    doneSet.has(item.id) ? { ...item, done: true } : item
  );

  const budgetOverrides =
    (planState.budgetOverrides as Record<string, { amount: number; spent: number }> | undefined) ?? {};
  const budgetCategories = buildBudgetCategories(answers).map((cat) => {
    const override = budgetOverrides[cat.id];
    if (!override) return cat;
    const amount = Math.max(0, Math.round(override.amount));
    const percentage =
      answers.budget > 0 ? Math.round((amount / answers.budget) * 1000) / 10 : 0;
    return {
      ...cat,
      amount,
      percentage,
      spent: override.spent,
    };
  });

  const storeTasks = (planState.tasks as Task[] | undefined) ?? [];
  const storeTaskIds = new Set(storeTasks.map((t) => t.id));
  const allTasks = [
    ...storeTasks,
    ...buildInitialTasks(answers).filter((t) => !storeTaskIds.has(t.id)),
  ];

  const vendors = (planState.vendors as Vendor[] | undefined) ?? [];

  // Build and send the digest
  const digest = buildDigest({ tasks: allTasks, timeline, vendors, answers, budgetCategories, emailPrefs });

  const recipients: string[] = [];
  if (emailPrefs.optInLouis && emailPrefs.emailLouis) recipients.push(emailPrefs.emailLouis);
  if (emailPrefs.optInPartner && emailPrefs.emailPartner) recipients.push(emailPrefs.emailPartner);

  const sent = await sendViaResend(recipients, digest.subject, digest.html, digest.plainText);

  console.log(`[email-digest/cron] sent=${sent} recipients=${recipients.length} stats=${JSON.stringify(digest.stats)}`);

  return NextResponse.json({ sent, stats: digest.stats, recipients: recipients.length });
}
