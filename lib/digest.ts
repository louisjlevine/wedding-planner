import type { Task, Vendor, WeddingAnswers, BudgetCategory, EmailDigestPrefs } from "./types";
import { describeWeddingDate, formatDate as formatISODate } from "./date-utils";
import { resolveDueDate } from "./plan-adapters";

export interface DigestRequestBody {
  // One list — milestones and tasks are the same thing now. Pre-merge clients
  // also send a `timeline` array; it's ignored rather than rejected.
  tasks: Task[];
  vendors: Vendor[];
  answers: WeddingAnswers;
  budgetCategories: BudgetCategory[];
  emailPrefs: EmailDigestPrefs;
  send?: boolean;
}

export function isValidDigestBody(body: unknown): body is DigestRequestBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    Array.isArray(b.tasks) &&
    Array.isArray(b.vendors) &&
    typeof b.answers === "object" && b.answers !== null &&
    Array.isArray(b.budgetCategories) &&
    typeof b.emailPrefs === "object" && b.emailPrefs !== null
  );
}

// Re-exported for callers that already import it from here. Parses the ISO date
// in local time so the day never slips backwards for western timezones.
export function formatDate(iso: string): string {
  return formatISODate(iso);
}

function generateHtml({
  coupleNames,
  daysUntil,
  weddingDateStr,
  overdueTasks,
  upcomingTasks,
  dueDateOf,
  totalSpent,
  remaining,
  budget,
  vendorNudges,
  appUrl,
}: {
  coupleNames: string;
  daysUntil: number;
  weddingDateStr: string;
  overdueTasks: Task[];
  upcomingTasks: Task[];
  dueDateOf: (task: Task) => string | undefined;
  totalSpent: number;
  remaining: number;
  budget: number;
  vendorNudges: Vendor[];
  appUrl: string;
}): string {
  const accent = "#D4537E";

  const taskRow = (title: string, detail: string, urgent = false) => `
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
        <span style="font-size: 14px; color: ${urgent ? "#dc2626" : "#111827"};">${title}</span>
        <br><span style="font-size: 12px; color: #9ca3af;">${detail}</span>
      </td>
    </tr>`;

  const section = (heading: string, color: string, rows: string) => `
    <tr><td style="padding: 20px 0 8px;">
      <p style="margin: 0 0 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: ${color};">${heading}</p>
      <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
    </td></tr>`;

  let body = "";

  const detail = (t: Task) => {
    const due = dueDateOf(t);
    return `Due ${due ? formatDate(due) : "–"} · ${t.category}`;
  };

  if (overdueTasks.length > 0) {
    const rows = overdueTasks.map((t) => taskRow(t.title, detail(t), true)).join("");
    body += section(`Overdue — ${overdueTasks.length} item${overdueTasks.length !== 1 ? "s" : ""}`, "#dc2626", rows);
  }

  if (upcomingTasks.length > 0) {
    const rows = upcomingTasks.map((t) => taskRow(t.title, detail(t))).join("");
    body += section("Due in the next 14 days", accent, rows);
  }

  const spentPct = budget > 0 ? Math.round((totalSpent / budget) * 100) : 0;
  const budgetRows = `
    <tr><td style="padding: 8px 0;">
      <div style="display: flex; justify-content: space-between; font-size: 13px; color: #374151; margin-bottom: 6px;">
        <span>Committed: <strong>$${totalSpent.toLocaleString()}</strong></span>
        <span>Remaining: <strong style="color: ${remaining < 0 ? "#dc2626" : "#059669"};">$${remaining.toLocaleString()}</strong></span>
      </div>
      <div style="background: #e5e7eb; border-radius: 9999px; height: 6px; overflow: hidden;">
        <div style="background: ${spentPct > 90 ? "#dc2626" : accent}; width: ${Math.min(spentPct, 100)}%; height: 100%;"></div>
      </div>
      <p style="margin: 4px 0 0; font-size: 11px; color: #9ca3af;">${spentPct}% of $${budget.toLocaleString()} budget used</p>
    </td></tr>`;
  body += section("Budget snapshot", "#374151", budgetRows);

  if (vendorNudges.length > 0) {
    const rows = vendorNudges
      .map((v) => taskRow(v.name, `${v.category} · still considering — have you heard back?`))
      .join("");
    body += section("Vendor follow-ups", "#d97706", rows);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Wedding Digest</title>
</head>
<body style="margin:0;padding:20px;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:white;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;max-width:600px;width:100%;">
  <!-- Header -->
  <tr><td style="background:${accent};padding:28px 32px 24px;">
    <h1 style="margin:0 0 4px;font-size:22px;font-weight:700;color:white;">Wedding Digest</h1>
    <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.9);">
      ${coupleNames} &bull;
      ${daysUntil > 0 ? `${daysUntil} day${daysUntil !== 1 ? "s" : ""} to go` : "Today is the day!"}
      (${weddingDateStr})
    </p>
  </td></tr>
  <!-- Body -->
  <tr><td style="padding:8px 32px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      ${body}
    </table>
    <!-- CTA -->
    <div style="margin-top:24px;text-align:center;">
      <a href="${appUrl}/planner" style="display:inline-block;background:${accent};color:white;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:15px;">Open Planner</a>
    </div>
  </td></tr>
  <!-- Footer -->
  <tr><td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9ca3af;">
      You&rsquo;re receiving this because you opted in to weekly wedding digests.
      &nbsp;&bull;&nbsp;
      <a href="${appUrl}/planner" style="color:${accent};text-decoration:none;">Manage preferences</a>
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function buildDigest(data: DigestRequestBody) {
  const { tasks, vendors, answers, budgetCategories } = data;

  // Relatively-scheduled tasks carry an offset rather than a date, so every
  // due-date read has to go through the resolver.
  const dueDateOf = (t: Task) => resolveDueDate(t, answers.date);

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + 14);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  const weddingDate = new Date(answers.date);
  const daysUntil = Math.ceil(
    (weddingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  const overdueTasks = tasks.filter((t) => {
    const due = dueDateOf(t);
    return !t.done && !!due && due < todayStr;
  });
  const upcomingTasks = tasks.filter((t) => {
    const due = dueDateOf(t);
    return !t.done && !!due && due >= todayStr && due <= cutoffStr;
  });
  const openItems = tasks.filter((t) => !t.done).length;
  const totalSpent = budgetCategories.reduce((s, c) => s + (c.spent ?? 0), 0);
  const remaining = answers.budget - totalSpent;
  const vendorNudges = vendors.filter((v) => v.status === "considering");

  const coupleNames = answers.partnerName
    ? `Louis & ${answers.partnerName}`
    : "Louis";

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  const subject =
    overdueTasks.length > 0
      ? `Wedding Digest: ${overdueTasks.length} overdue task${overdueTasks.length !== 1 ? "s" : ""}, ${daysUntil} days to go`
      : `Wedding Digest: ${daysUntil} day${daysUntil !== 1 ? "s" : ""} to go`;

  const lines: string[] = [
    `Wedding Digest — ${coupleNames}`,
    daysUntil > 0
      ? `${daysUntil} days until your wedding (${describeWeddingDate(answers)})`
      : `Today is your wedding day! (${describeWeddingDate(answers)})`,
    "",
  ];

  if (overdueTasks.length > 0) {
    lines.push(`OVERDUE TASKS (${overdueTasks.length})`);
    overdueTasks.forEach((t) => {
      lines.push(`  [!] ${t.title} — due ${dueDateOf(t) ?? "unknown"} — ${t.category}`);
    });
    lines.push("");
  }

  if (upcomingTasks.length > 0) {
    lines.push(`TASKS DUE IN THE NEXT 14 DAYS (${upcomingTasks.length})`);
    upcomingTasks.forEach((t) => {
      lines.push(`  [ ] ${t.title} — due ${dueDateOf(t) ?? "unknown"} — ${t.category}`);
    });
    lines.push("");
  }

  lines.push("BUDGET SNAPSHOT");
  lines.push(`  Total budget:  $${answers.budget.toLocaleString()}`);
  lines.push(`  Committed:     $${totalSpent.toLocaleString()}`);
  lines.push(`  Remaining:     $${remaining.toLocaleString()}`);
  lines.push("");

  if (vendorNudges.length > 0) {
    lines.push(`VENDOR FOLLOW-UPS (${vendorNudges.length})`);
    vendorNudges.forEach((v) => {
      lines.push(`  ${v.name} (${v.category}) — still considering, have you heard back?`);
    });
    lines.push("");
  }

  if (appUrl) lines.push(`Open your planner: ${appUrl}/planner`);

  const html = generateHtml({
    coupleNames,
    daysUntil,
    weddingDateStr: describeWeddingDate(answers),
    overdueTasks,
    upcomingTasks,
    dueDateOf,
    totalSpent,
    remaining,
    budget: answers.budget,
    vendorNudges,
    appUrl,
  });

  return {
    subject,
    plainText: lines.join("\n"),
    html,
    stats: {
      overdueTasks: overdueTasks.length,
      upcomingTasks: upcomingTasks.length,
      openItems,
    },
  };
}

export async function sendViaResend(
  to: string[],
  subject: string,
  html: string,
  text: string
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const from = process.env.DIGEST_FROM_EMAIL ?? "Wedding Planner <digest@resend.dev>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from, to, subject, html, text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
