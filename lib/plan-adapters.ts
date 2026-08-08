import type {
  WeddingAnswers,
  BudgetCategory,
  AdaptiveAdjustment,
  Task,
} from "./types";
import { dateDaysBefore, dateMonthsBefore } from "./date-utils";

// ── Budget ────────────────────────────────────────────────────────────────────

// Formats an allocated amount as "~$X,XXX — " prefix for descriptions.
// Called after normalization so the figure matches what the user sees.
function amtPrefix(amounts: Record<string, number>, id: string): string {
  const v = amounts[id];
  return v != null ? `~$${v.toLocaleString()} — ` : "";
}

function buildCategoryDescriptions(
  answers: WeddingAnswers,
  amounts: Record<string, number>,
): Record<string, string> {
  const { guestCount, budget, priorities } = answers;
  const isLuxury = budget >= 100_000;
  const cateringAmt = amounts.catering ?? 0;
  const cateringPerHead = guestCount > 0 && cateringAmt > 0
    ? Math.round(cateringAmt / guestCount)
    : 0;
  const centerpieces = Math.ceil(guestCount / 8);
  const bouquets = Math.max(2, Math.round(guestCount / 15));
  const a = (id: string) => amtPrefix(amounts, id);

  return {
    venue:
      `${a("venue")}rental fee for ceremony and reception spaces, including setup and breakdown time.` +
      (guestCount >= 150
        ? ` With ${guestCount} guests, capacity will be a primary filter — expect higher minimums at larger venues.`
        : guestCount < 50
        ? ` Smaller guest count gives you access to intimate spaces like restaurants, estates, or galleries that larger groups can't use.`
        : ` Includes cocktail hour space and reception hall for ${guestCount} guests.`),
    catering:
      `${a("catering")}food service, bar, rentals (tables, chairs, linens if not included with venue), and staff gratuity for ${guestCount} guests.` +
      (isLuxury
        ? ` At this budget level, consider a plated multi-course meal or elevated family-style service with premium bar selections.`
        : cateringPerHead > 0
        ? ` Estimated ~$${cateringPerHead}/person before gratuity — buffet or family-style service can stretch the budget further than plated.`
        : ``),
    photography:
      `${a("photography")}lead photographer` +
      (priorities.includes("photography")
        ? `, second shooter, and videographer. Photography is one of your top priorities, so investing here ensures you have premium coverage of every moment.`
        : ` and optional second shooter or videographer. Full-day packages typically include 8 hours of coverage plus edited digital files delivered within 6–12 weeks.`) +
      ` Top photographers book 12–18 months in advance.`,
    flowers:
      `${a("flowers")}bridal bouquet, approximately ${bouquets} bridesmaid bouquets, boutonnieres for the wedding party, ceremony arch or altar arrangements, and roughly ${centerpieces} reception table centerpieces for ${guestCount} guests.` +
      (isLuxury
        ? ` Luxury installs like floral chandeliers, statement arches, or bespoke greenery walls can elevate the aesthetic significantly at this budget level.`
        : ` Choosing seasonal, locally-grown flowers can reduce floral costs by 20–30%.`),
    music:
      `${a("music")}DJ or live band for ceremony and reception, including sound equipment and MC services.` +
      (isLuxury
        ? ` A live band ($5,000–$15,000+) creates an unmatched atmosphere. Consider a smaller jazz trio for cocktail hour and a full band for the reception.`
        : ` A professional DJ ($1,500–$3,500) is the most cost-efficient option and can handle ceremony music, cocktail hour, and the full reception.`),
    attire:
      `${a("attire")}wedding dress or suit, alterations, accessories, veil, and hair & makeup for the wedding day.` +
      ` Budget tip: alterations alone can run $300–$1,000, so factor this into your dress budget from the start.` +
      (isLuxury ? ` Designer gowns and full bridal party styling are well within range at this budget level.` : ``),
    stationery:
      `${a("stationery")}save-the-dates, invitations, RSVP cards, and day-of items (programs, menus, place cards) for ${guestCount} guests.` +
      ` Digital save-the-dates can reduce costs significantly. Printed suites typically run $3–$12 per invitation set depending on paper stock and printing method.`,
    transport:
      `${a("transport")}getaway car for the couple and optional shuttle service for guests between venue, hotel, and parking areas.` +
      (guestCount >= 100
        ? ` With ${guestCount} guests, a shuttle greatly reduces parking headaches and ensures everyone arrives safely.`
        : ` With a smaller guest count, shuttles may be optional — but a classic getaway car is a memorable touch.`),
    rings:
      `${a("rings")}wedding bands for both partners.` +
      ` Simple gold or platinum bands start around $300–$600 each. Custom or diamond-set bands can range from $1,500–$5,000+.` +
      (isLuxury ? ` At this budget, consider matching custom bands or incorporating stones from heirloom jewelry.` : ``),
    misc:
      `${a("misc")}vendor gratuities (plan $20–$100 per vendor), day-of coordinator fees if not elsewhere, and unexpected costs.` +
      ` Most couples spend 5–10% above initial estimates — this buffer prevents budget stress in the final weeks before the wedding.`,
  };
}

// Industry-default baseline percentages (before any adaptive adjustments)
const BUDGET_BASELINES: Record<string, number> = {
  venue: 28,
  catering: 23,
  photography: 10,
  flowers: 8,
  music: 7,
  attire: 8,
  stationery: 2,
  transport: 2,
  rings: 3,
  misc: 5,
};

export function buildBudgetCategories(
  answers: WeddingAnswers
): BudgetCategory[] {
  const total = answers.budget;
  const isLuxury = total >= 100_000;

  const foodPriority = answers.priorities.includes("food");
  const photoPriority = answers.priorities.includes("photography");

  const base: Array<{
    id: string;
    name: string;
    pct: number;
    tip?: string;
    adjustments: AdaptiveAdjustment[];
  }> = [
    {
      id: "venue",
      name: "Venue",
      pct: BUDGET_BASELINES.venue,
      adjustments: [],
    },
    {
      id: "catering",
      name: "Catering & Bar",
      pct: foodPriority ? 28 : BUDGET_BASELINES.catering,
      tip: foodPriority ? "Food is a top priority — budget boosted 5%" : undefined,
      adjustments: foodPriority
        ? [{ reason: "Food listed as a top priority", delta: 5 }]
        : [],
    },
    {
      id: "photography",
      name: "Photography & Video",
      pct: photoPriority ? 15 : BUDGET_BASELINES.photography,
      tip: photoPriority
        ? "Photography is a top priority — budget boosted 5%"
        : isLuxury
        ? "Consider a luxury film photographer for this budget level"
        : undefined,
      adjustments: photoPriority
        ? [{ reason: "Photography listed as a top priority", delta: 5 }]
        : isLuxury
        ? [{ reason: "Luxury budget tier — consider premium vendors", delta: 0 }]
        : [],
    },
    { id: "flowers", name: "Flowers & Decor", pct: BUDGET_BASELINES.flowers, adjustments: [] },
    { id: "music", name: "Music & Entertainment", pct: BUDGET_BASELINES.music, adjustments: [] },
    { id: "attire", name: "Attire & Beauty", pct: BUDGET_BASELINES.attire, adjustments: [] },
    { id: "stationery", name: "Stationery", pct: BUDGET_BASELINES.stationery, adjustments: [] },
    { id: "transport", name: "Transportation", pct: BUDGET_BASELINES.transport, adjustments: [] },
    { id: "rings", name: "Rings", pct: BUDGET_BASELINES.rings, adjustments: [] },
    { id: "misc", name: "Miscellaneous / Buffer", pct: BUDGET_BASELINES.misc, adjustments: [] },
  ];

  // Normalise percentages to 100
  const totalPct = base.reduce((sum, c) => sum + c.pct, 0);
  const scale = 100 / totalPct;

  // Compute final amounts first so descriptions can reference the actual dollar figure.
  const amounts: Record<string, number> = {};
  for (const c of base) {
    const pct = Math.round(c.pct * scale * 10) / 10;
    amounts[c.id] = Math.round((pct / 100) * total);
  }

  const descriptions = buildCategoryDescriptions(answers, amounts);

  return base.map((c) => {
    const pct = Math.round(c.pct * scale * 10) / 10;
    return {
      id: c.id,
      name: c.name,
      percentage: pct,
      amount: amounts[c.id]!,
      spent: 0,
      tip: c.tip,
      description: descriptions[c.id],
      baselinePercentage: BUDGET_BASELINES[c.id] ?? c.pct,
      adjustments: c.adjustments,
    };
  });
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

/**
 * The starting plan: every item the couple gets before they touch anything.
 * This used to be two lists — `buildTimeline()` milestones and `buildInitialTasks()`
 * tasks — rendered as separate types. They're one list of `Task` now, and the
 * former milestones are simply the items scheduled by `monthsBefore`.
 */
export function buildInitialTasks(answers: WeddingAnswers): Task[] {
  const isOutdoor = answers.setting === "outdoor" || answers.setting === "mixed";
  const location = answers.location.toLowerCase();
  const isMountain =
    location.includes("mountain") ||
    location.includes("colorado") ||
    location.includes("aspen") ||
    location.includes("vail");

  const tasks: Task[] = [
    // ── Undated admin ──
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
    // ── Scheduled relative to the wedding day ──
    {
      id: "venue",
      title: "Book your venue",
      monthsBefore: 12,
      category: "Venue",
      priority: "high",
      done: false,
      flag: isMountain
        ? "Book early — mountain venues fill 18+ months out"
        : answers.guestCount < 50
        ? "Smaller guest list gives you more venue flexibility"
        : undefined,
    },
    {
      id: "photographer",
      title: "Book photographer & videographer",
      monthsBefore: 12,
      category: "Photography",
      priority: "high",
      done: false,
    },
    {
      id: "t4",
      title: "Research & tour venues",
      monthsBefore: 12,
      category: "Venue",
      priority: "high",
      done: false,
      flag:
        answers.guestCount < 50
          ? "Smaller guest list — more flexibility on venue timing"
          : undefined,
    },
    {
      id: "t3",
      title: "Draft your guest list",
      monthsBefore: 11,
      category: "Guests",
      priority: "high",
      done: false,
    },
    {
      id: "catering",
      title: "Select caterer / catering style",
      monthsBefore: 10,
      category: "Catering",
      priority: "high",
      done: false,
    },
    {
      id: "dress",
      title: "Start dress / attire shopping",
      monthsBefore: 10,
      category: "Attire",
      priority: "medium",
      done: false,
    },
    {
      id: "flowers",
      title: "Consult with florists",
      monthsBefore: 9,
      category: "Flowers",
      priority: "medium",
      done: false,
    },
    {
      id: "music",
      title: "Book band or DJ",
      monthsBefore: 9,
      category: "Music",
      priority: "medium",
      done: false,
    },
    {
      id: "t5",
      title: "Book officiant",
      monthsBefore: 9,
      category: "Ceremony",
      priority: "medium",
      done: false,
    },
    {
      id: "t6",
      title: "Create wedding website",
      monthsBefore: 8,
      category: "Admin",
      priority: "medium",
      done: false,
    },
    {
      id: "invitations",
      title: "Design & order invitations",
      monthsBefore: 6,
      category: "Stationery",
      priority: "medium",
      done: false,
    },
    {
      id: "t7",
      title: "Plan honeymoon",
      monthsBefore: 6,
      category: "Honeymoon",
      priority: answers.priorities.includes("honeymoon") ? "high" : "low",
      done: false,
    },
    {
      id: "send_invites",
      title: "Send invitations",
      monthsBefore: 4,
      category: "Stationery",
      priority: "high",
      done: false,
    },
    {
      id: "rsvp_deadline",
      title: "RSVP deadline",
      monthsBefore: 2,
      category: "Guests",
      priority: "high",
      done: false,
    },
    {
      id: "final_headcount",
      title: "Final headcount to caterer",
      monthsBefore: 1,
      category: "Catering",
      priority: "high",
      done: false,
    },
    {
      id: "rehearsal",
      title: "Rehearsal & rehearsal dinner",
      daysBefore: 1,
      category: "Ceremony",
      priority: "high",
      done: false,
    },
    {
      id: "wedding_day",
      title: "Wedding day! 💍",
      daysBefore: 0,
      category: "Wedding",
      priority: "high",
      done: false,
    },
  ];

  if (isOutdoor) {
    tasks.push(
      {
        id: "tent_weather",
        title: "Confirm tent / weather contingency plan",
        monthsBefore: 6,
        category: "Logistics",
        priority: "high",
        done: false,
        flag: "Outdoor setting — have a rain backup ready",
      },
      {
        id: "t_tent",
        title: "Get quotes for tent rental & weather backup",
        monthsBefore: 9,
        category: "Logistics",
        priority: "high",
        done: false,
        flag: "Required for outdoor setting",
      },
    );
  }

  return tasks.sort((a, b) => seedOffsetDays(b) - seedOffsetDays(a));
}

/** Sort key for the seed list: furthest out first, undated items last. */
function seedOffsetDays(task: Task): number {
  if (task.daysBefore != null) return task.daysBefore;
  if (task.monthsBefore != null) return task.monthsBefore * 31;
  return -1;
}

/**
 * The date a task actually lands on. An explicit `dueDate` wins; otherwise the
 * offset is applied to the wedding day, so relatively-scheduled items follow the
 * wedding date whenever it changes. Undefined when the task has no date, or when
 * it's relative and the wedding date isn't set yet.
 */
export function resolveDueDate(
  task: Pick<Task, "dueDate" | "monthsBefore" | "daysBefore">,
  weddingDate: string | undefined | null,
): string | undefined {
  if (task.dueDate) return task.dueDate;
  if (task.daysBefore != null) return dateDaysBefore(weddingDate, task.daysBefore) || undefined;
  if (task.monthsBefore != null) return dateMonthsBefore(weddingDate, task.monthsBefore) || undefined;
  return undefined;
}

/** Human label for how a task is scheduled, e.g. "12 months before the wedding". */
export function describeSchedule(task: Pick<Task, "monthsBefore" | "daysBefore">): string | undefined {
  if (task.daysBefore != null) {
    if (task.daysBefore === 0) return "on the wedding day";
    return `${task.daysBefore} day${task.daysBefore === 1 ? "" : "s"} before the wedding`;
  }
  if (task.monthsBefore != null) {
    if (task.monthsBefore === 0) return "on the wedding day";
    return `${task.monthsBefore} month${task.monthsBefore === 1 ? "" : "s"} before the wedding`;
  }
  return undefined;
}

/**
 * The full plan: everything the user has touched (which lives in the store)
 * plus any seed item they haven't. Adapter-derived tasks are only persisted
 * once edited, so counting the store alone undercounts the plan.
 */
export function mergePlanTasks(storeTasks: Task[], seedTasks: Task[]): Task[] {
  const storeIds = new Set(storeTasks.map((t) => t.id));
  return [...storeTasks, ...seedTasks.filter((t) => !storeIds.has(t.id))];
}

/**
 * Milestones used to be tracked separately, with completion recorded as a list
 * of ids in `timelineDoneIds`. They're ordinary tasks now, so that done state
 * has to be materialised into the task list. Used by the store migration and by
 * any read path that can still see pre-merge persisted state.
 */
export function adoptLegacyMilestoneDoneIds(
  answers: WeddingAnswers | null | undefined,
  tasks: Task[],
  doneIds: string[],
): Task[] {
  if (!answers || doneIds.length === 0) return tasks;
  const existing = new Set(tasks.map((t) => t.id));
  const seeds = new Map(buildInitialTasks(answers).map((t) => [t.id, t]));
  const adopted: Task[] = [];
  for (const id of doneIds) {
    if (existing.has(id)) continue;
    const seed = seeds.get(id);
    if (seed) adopted.push({ ...seed, done: true });
  }
  return adopted.length > 0 ? [...tasks, ...adopted] : tasks;
}
