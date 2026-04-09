import type {
  WeddingAnswers,
  TimelineItem,
  BudgetCategory,
  AdaptiveAdjustment,
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

function buildCategoryDescriptions(answers: WeddingAnswers): Record<string, string> {
  const { guestCount, budget, priorities } = answers;
  const isLuxury = budget >= 100_000;
  const cateringPerHead = guestCount > 0 ? Math.round((budget * 0.23) / guestCount) : 0;
  const centerpieces = Math.ceil(guestCount / 8);
  const bouquets = Math.max(2, Math.round(guestCount / 15));

  return {
    venue:
      `Covers the rental fee for ceremony and reception spaces, including setup and breakdown time.` +
      (guestCount >= 150
        ? ` With ${guestCount} guests, capacity will be a primary filter — expect higher minimums at larger venues.`
        : guestCount < 50
        ? ` Smaller guest count gives you access to intimate spaces like restaurants, estates, or galleries that larger groups can't use.`
        : ` Includes cocktail hour space and reception hall for ${guestCount} guests.`),
    catering:
      `Covers food service, bar, rentals (tables, chairs, linens if not included with venue), and staff gratuity for ${guestCount} guests.` +
      (isLuxury
        ? ` At this budget level, consider a plated multi-course meal or elevated family-style service with premium bar selections.`
        : cateringPerHead > 0
        ? ` Estimated ~$${cateringPerHead}/person before gratuity — buffet or family-style service can stretch the budget further than plated.`
        : ``),
    photography:
      `Covers lead photographer` +
      (priorities.includes("photography")
        ? `, second shooter, and videographer. Photography is one of your top priorities, so investing here ensures you have premium coverage of every moment.`
        : ` and optional second shooter or videographer. Full-day packages typically include 8 hours of coverage plus edited digital files delivered within 6–12 weeks.`) +
      ` Top photographers book 12–18 months in advance.`,
    flowers:
      `Covers bridal bouquet, approximately ${bouquets} bridesmaid bouquets, boutonnieres for the wedding party, ceremony arch or altar arrangements, and roughly ${centerpieces} reception table centerpieces for ${guestCount} guests.` +
      (isLuxury
        ? ` Luxury installs like floral chandeliers, statement arches, or bespoke greenery walls can elevate the aesthetic significantly at this budget level.`
        : ` Choosing seasonal, locally-grown flowers can reduce floral costs by 20–30%.`),
    music:
      `Covers DJ or live band for ceremony and reception, including sound equipment and MC services.` +
      (isLuxury
        ? ` A live band ($5,000–$15,000+) creates an unmatched atmosphere. Consider a smaller jazz trio for cocktail hour and a full band for the reception.`
        : ` A professional DJ ($1,500–$3,500) is the most cost-efficient option and can handle ceremony music, cocktail hour, and the full reception.`),
    attire:
      `Covers the wedding dress or suit, alterations, accessories, veil, and hair & makeup for the wedding day.` +
      ` Budget tip: alterations alone can run $300–$1,000, so factor this into your dress budget from the start.` +
      (isLuxury ? ` Designer gowns and full bridal party styling are well within range at this budget level.` : ``),
    stationery:
      `Covers save-the-dates, invitations, RSVP cards, and day-of items (programs, menus, place cards) for ${guestCount} guests.` +
      ` Digital save-the-dates can reduce costs significantly. Printed suites typically run $3–$12 per invitation set depending on paper stock and printing method.`,
    transport:
      `Covers a getaway car for the couple and optional shuttle service for guests between venue, hotel, and parking areas.` +
      (guestCount >= 100
        ? ` With ${guestCount} guests, a shuttle greatly reduces parking headaches and ensures everyone arrives safely.`
        : ` With a smaller guest count, shuttles may be optional — but a classic getaway car is a memorable touch.`),
    rings:
      `Covers wedding bands for both partners.` +
      ` Simple gold or platinum bands start around $300–$600 each. Custom or diamond-set bands can range from $1,500–$5,000+.` +
      (isLuxury ? ` At this budget, consider matching custom bands or incorporating stones from heirloom jewelry.` : ``),
    misc:
      `Reserved for vendor gratuities (plan $20–$100 per vendor), day-of coordinator fees if not elsewhere, and unexpected costs.` +
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

  const descriptions = buildCategoryDescriptions(answers);

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

  return base.map((c) => {
    const pct = Math.round(c.pct * scale * 10) / 10;
    return {
      id: c.id,
      name: c.name,
      percentage: pct,
      amount: Math.round((pct / 100) * total),
      spent: 0,
      tip: c.tip,
      description: descriptions[c.id],
      baselinePercentage: BUDGET_BASELINES[c.id] ?? c.pct,
      adjustments: c.adjustments,
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
