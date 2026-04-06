import type {
  WeddingAnswers,
  TimelineItem,
  BudgetCategory,
  Task,
} from "./types";

// ── Timeline ──────────────────────────────────────────────────────────────────

export function buildTimeline(answers: WeddingAnswers): TimelineItem[] {
  const items: TimelineItem[] = [
    {
      id: "venue",
      title: "Book your venue",
      monthsBefore: 12,
      targetDate: monthsBefore(answers.date, 12),
      category: "Venue",
      done: false,
      flag:
        answers.location.toLowerCase().includes("mountain") ||
        answers.location.toLowerCase().includes("colorado") ||
        answers.location.toLowerCase().includes("aspen") ||
        answers.location.toLowerCase().includes("vail")
          ? "Book early — mountain venues fill 18+ months out"
          : answers.guestCount < 50
          ? "Smaller guest list gives you more venue flexibility"
          : undefined,
    },
    {
      id: "photographer",
      title: "Book photographer & videographer",
      monthsBefore: 12,
      targetDate: monthsBefore(answers.date, 12),
      category: "Photography",
      done: false,
    },
    {
      id: "catering",
      title: "Select caterer / catering style",
      monthsBefore: 10,
      targetDate: monthsBefore(answers.date, 10),
      category: "Catering",
      done: false,
    },
    {
      id: "dress",
      title: "Start dress / attire shopping",
      monthsBefore: 10,
      targetDate: monthsBefore(answers.date, 10),
      category: "Attire",
      done: false,
    },
    {
      id: "flowers",
      title: "Consult with florists",
      monthsBefore: 9,
      targetDate: monthsBefore(answers.date, 9),
      category: "Flowers",
      done: false,
    },
    {
      id: "music",
      title: "Book band or DJ",
      monthsBefore: 9,
      targetDate: monthsBefore(answers.date, 9),
      category: "Music",
      done: false,
    },
    {
      id: "invitations",
      title: "Design & order invitations",
      monthsBefore: 6,
      targetDate: monthsBefore(answers.date, 6),
      category: "Stationery",
      done: false,
    },
    {
      id: "send_invites",
      title: "Send invitations",
      monthsBefore: 4,
      targetDate: monthsBefore(answers.date, 4),
      category: "Stationery",
      done: false,
    },
    {
      id: "rsvp_deadline",
      title: "RSVP deadline",
      monthsBefore: 2,
      targetDate: monthsBefore(answers.date, 2),
      category: "Guests",
      done: false,
    },
    {
      id: "final_headcount",
      title: "Final headcount to caterer",
      monthsBefore: 1,
      targetDate: monthsBefore(answers.date, 1),
      category: "Catering",
      done: false,
    },
    {
      id: "rehearsal",
      title: "Rehearsal & rehearsal dinner",
      monthsBefore: 0,
      targetDate: daysBefore(answers.date, 1),
      category: "Ceremony",
      done: false,
    },
    {
      id: "wedding_day",
      title: "Wedding day! 💍",
      monthsBefore: 0,
      targetDate: answers.date,
      category: "Wedding",
      done: false,
    },
  ];

  // Outdoor setting → add weather contingency
  if (answers.setting === "outdoor" || answers.setting === "mixed") {
    items.splice(1, 0, {
      id: "tent_weather",
      title: "Confirm tent / weather contingency plan",
      monthsBefore: 6,
      targetDate: monthsBefore(answers.date, 6),
      category: "Logistics",
      flag: "Outdoor setting — have a rain backup ready",
      done: false,
    });
  }

  return items.sort((a, b) => b.monthsBefore - a.monthsBefore);
}

// ── Budget ────────────────────────────────────────────────────────────────────

export function buildBudgetCategories(
  answers: WeddingAnswers
): BudgetCategory[] {
  const total = answers.budget;
  const isLuxury = total >= 100_000;

  const base: Array<{
    id: string;
    name: string;
    pct: number;
    tip?: string;
  }> = [
    { id: "venue", name: "Venue", pct: 28 },
    {
      id: "catering",
      name: "Catering & Bar",
      pct: answers.priorities.includes("food") ? 28 : 23,
      tip: answers.priorities.includes("food")
        ? "Food is a top priority — budget boosted 5%"
        : undefined,
    },
    {
      id: "photography",
      name: "Photography & Video",
      pct: answers.priorities.includes("photography") ? 15 : 10,
      tip: answers.priorities.includes("photography")
        ? "Photography is a top priority — budget boosted 5%"
        : isLuxury
        ? "Consider a luxury film photographer for this budget level"
        : undefined,
    },
    { id: "flowers", name: "Flowers & Decor", pct: 8 },
    { id: "music", name: "Music & Entertainment", pct: 7 },
    { id: "attire", name: "Attire & Beauty", pct: 8 },
    { id: "stationery", name: "Stationery", pct: 2 },
    { id: "transport", name: "Transportation", pct: 2 },
    { id: "rings", name: "Rings", pct: 3 },
    { id: "misc", name: "Miscellaneous / Buffer", pct: 5 },
  ];

  // Normalise percentages to 100
  const totalPct = base.reduce((sum, c) => sum + c.pct, 0);
  const scale = 100 / totalPct;

  return base.map((c) => {
    const pct = Math.round(c.pct * scale * 10) / 10;
    return {
      id: c.id,
      name: c.name,
      percentage: pct,
      amount: Math.round((pct / 100) * total),
      spent: 0,
      tip: c.tip,
    };
  });
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

export function buildInitialTasks(answers: WeddingAnswers): Task[] {
  const tasks: Task[] = [
    {
      id: "t1",
      title: "Create a wedding email address",
      category: "Admin",
      priority: "high",
      done: false,
    },
    {
      id: "t2",
      title: "Set your overall budget",
      category: "Budget",
      priority: "high",
      done: true,
    },
    {
      id: "t3",
      title: "Draft your guest list",
      category: "Guests",
      priority: "high",
      done: false,
      dueDate: monthsBefore(answers.date, 11),
    },
    {
      id: "t4",
      title: "Research & tour venues",
      category: "Venue",
      priority: "high",
      done: false,
      dueDate: monthsBefore(answers.date, 12),
      flag:
        answers.guestCount < 50
          ? "Smaller guest list — more flexibility on venue timing"
          : undefined,
    },
    {
      id: "t5",
      title: "Book officiant",
      category: "Ceremony",
      priority: "medium",
      done: false,
      dueDate: monthsBefore(answers.date, 9),
    },
    {
      id: "t6",
      title: "Create wedding website",
      category: "Admin",
      priority: "medium",
      done: false,
      dueDate: monthsBefore(answers.date, 8),
    },
    {
      id: "t7",
      title: "Plan honeymoon",
      category: "Honeymoon",
      priority: answers.priorities.includes("honeymoon") ? "high" : "low",
      done: false,
      dueDate: monthsBefore(answers.date, 6),
    },
  ];

  if (answers.setting === "outdoor" || answers.setting === "mixed") {
    tasks.push({
      id: "t_tent",
      title: "Get quotes for tent rental & weather backup",
      category: "Logistics",
      priority: "high",
      done: false,
      flag: "Required for outdoor setting",
      dueDate: monthsBefore(answers.date, 9),
    });
  }

  return tasks;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function monthsBefore(isoDate: string, months: number): string {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  d.setMonth(d.getMonth() - months);
  return d.toISOString().split("T")[0];
}

function daysBefore(isoDate: string, days: number): string {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}
