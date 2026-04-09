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

  // Approximate dollar allocations based on baselines (before normalization scaling)
  const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;
  const photoBasePct = priorities.includes("photography") ? 0.15 : 0.10;
  const cateringBasePct = priorities.includes("food") ? 0.28 : 0.23;
  const venueAmt    = budget * 0.28;
  const cateringAmt = budget * cateringBasePct;
  const photoAmt    = budget * photoBasePct;
  const flowersAmt  = budget * 0.08;
  const musicAmt    = budget * 0.07;
  const attireAmt   = budget * 0.08;
  const stationeryAmt = budget * 0.02;
  const transportAmt  = budget * 0.02;
  const ringsAmt    = budget * 0.03;
  const miscAmt     = budget * 0.05;

  const cateringPerHead = guestCount > 0 ? Math.round(cateringAmt / guestCount) : 0;
  const centerpieces = Math.ceil(guestCount / 8);
  const bouquets = Math.max(2, Math.round(guestCount / 15));

  return {
    venue:
      `Your ~${fmt(venueAmt)} venue budget covers rental fees for both ceremony and reception spaces, including setup and breakdown windows.` +
      (guestCount >= 150
        ? ` With ${guestCount} guests, capacity is your primary filter — most venues at this size charge $5,000–$15,000+ for the space alone, so verify what's included (catering exclusivity, A/V, parking) before comparing quotes.`
        : guestCount < 50
        ? ` A guest list under 50 opens doors to intimate settings — private dining rooms, historic estates, and art galleries — that larger weddings can't access, often at a fraction of the cost.`
        : ` Budget for a 4–6 hour reception window; overtime fees ($250–$500/hr) add up quickly, so confirm the exact rental period before signing.`),
    catering:
      `Your ~${fmt(cateringAmt)} catering budget works out to roughly ${cateringPerHead > 0 ? `$${cateringPerHead}/person` : `a per-head allocation`} for ${guestCount} guests, covering food service, bar, rental equipment (tables, chairs, linens unless the venue provides them), and staff gratuity.` +
      (isLuxury
        ? ` At this budget, a plated multi-course meal or elevated family-style service with a premium open bar is achievable — ask caterers about chef-attended stations and specialty cocktails.`
        : ` Buffet and family-style service typically run 15–25% less than plated, and guests often prefer the flexibility. Prioritise the bar package — it's usually the highest per-head cost.`),
    photography:
      `Your ~${fmt(photoAmt)} photography budget covers` +
      (priorities.includes("photography")
        ? ` a lead photographer, second shooter, and videographer — a full creative team to capture every moment. This is one of your top priorities, so use the extra allocation to secure an experienced team whose editing style matches your vision.`
        : ` a lead photographer and optional second shooter or videographer. Full-day packages (8–10 hours) in this range typically include engagement session rights and edited digital files delivered within 6–12 weeks.`) +
      ` Top photographers book 12–18 months in advance — lock this in early.`,
    flowers:
      `Your ~${fmt(flowersAmt)} floral budget covers a bridal bouquet, approximately ${bouquets} bridesmaid bouquets, boutonnieres for the wedding party, ceremony arch or altar arrangements, and roughly ${centerpieces} reception table centerpieces for ${guestCount} guests.` +
      (isLuxury
        ? ` At this level, statement installs like floral chandeliers, bespoke greenery walls, or oversized arrangements are well within reach — ask florists for a mood-board proposal to see options.`
        : ` Choosing in-season, locally-grown flowers can cut costs by 20–30%. Ask your florist which blooms are at peak availability on your wedding date.`),
    music:
      `Your ~${fmt(musicAmt)} entertainment budget covers music for ceremony, cocktail hour, and reception, including sound equipment and MC services.` +
      (isLuxury
        ? ` A live band ($5,000–$15,000+) creates an energy a DJ can't replicate — consider pairing a jazz trio for cocktail hour with a full band for the reception. Ask about set lists, breaks, and overtime rates upfront.`
        : ` A professional DJ ($1,500–$3,500) handles ceremony, cocktail hour, and reception in one hire. Look for packages that include lighting and ask for a sample playlist to gauge fit.`),
    attire:
      `Your ~${fmt(attireAmt)} attire budget covers the wedding gown or suit, alterations, accessories, veil or headpiece, and hair & makeup for the wedding day.` +
      ` Alterations alone typically run $300–$1,000, so treat them as a line item from the start rather than a surprise at the end.` +
      (isLuxury
        ? ` Designer gowns and full-party styling (hair and makeup for the entire bridal party) are comfortably within reach at this level.`
        : ` Trunk shows and sample sales are the fastest way to access designer gowns at 20–50% off retail — ask bridal shops about upcoming events.`),
    stationery:
      `Your ~${fmt(stationeryAmt)} stationery budget covers save-the-dates, full invitation suites (invitation, RSVP, details card, envelopes), and day-of items (programs, menus, escort cards) for ${guestCount} guests.` +
      ` Printed suites typically run $3–$12 per set depending on paper stock and printing method. Digital save-the-dates ($0–$50 total via Paperless Post or Zola) can free up budget for premium printed invitations.`,
    transport:
      `Your ~${fmt(transportAmt)} transportation budget covers a getaway car for the couple and optional shuttle service for guests between the ceremony, reception, and nearby hotels.` +
      (guestCount >= 100
        ? ` With ${guestCount} guests, a shuttle run ($600–$1,500 for a 4-hour coach) dramatically reduces parking stress and drunk-driving risk — many venues strongly recommend it at this size.`
        : ` With a smaller guest list, a shuttle may be optional — but a classic getaway car or vintage vehicle makes for memorable departure photos and is typically $500–$1,200 for a half-day booking.`),
    rings:
      `Your ~${fmt(ringsAmt)} ring budget covers wedding bands for both partners.` +
      ` Simple gold or platinum bands start at $300–$600 each; pavé, channel-set, or custom engraved bands typically run $800–$2,500 each.` +
      (isLuxury
        ? ` At this budget, matching custom bands or bands set with diamonds or gemstones are a natural choice — consider sourcing heirloom stones for a personal touch.`
        : ` Buying from an independent jeweller or estate dealer can get you significantly more quality for the price compared to chain retailers.`),
    misc:
      `Your ~${fmt(miscAmt)} buffer is reserved for vendor gratuities (plan $50–$100 for photographers, $50–$150 for caterers, $20–$50 for each other vendor), day-of coordinator fees if not booked separately, and the unexpected costs that surface in every wedding.` +
      ` Most couples end up spending 5–10% above their initial estimates — having this reserve means late additions (extra florals, a last-minute hair trial, upgraded linens) don't force difficult trade-offs in the final weeks.`,
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
