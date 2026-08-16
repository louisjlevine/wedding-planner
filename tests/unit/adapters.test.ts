import { describe, it, expect } from "vitest";
import {
  assigneeSuggestions,
  buildBudgetCategories,
  buildInitialTasks,
  describeSchedule,
  mergePlanTasks,
  adoptLegacyMilestoneDoneIds,
  resolveDueDate,
} from "@/lib/plan-adapters";
import type { Task } from "@/lib/types";
import type { WeddingAnswers } from "@/lib/types";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE_ANSWERS: WeddingAnswers = {
  partnerName: "Alex",
  date: "2026-06-15",
  location: "New York, NY",
  guestCount: 100,
  budget: 50_000,
  vibe: ["romantic", "classic"],
  priorities: ["venue", "photography", "food"],
  setting: "indoor",
  funding: "self",
  stress: ["budget", "logistics"],
};

// ── buildInitialTasks — the single merged plan list ───────────────────────────

describe("buildInitialTasks — one list, no milestone/task split", () => {
  it("returns former milestones and former tasks in the same array", () => {
    const items = buildInitialTasks(BASE_ANSWERS);
    // "venue" was a milestone, "t1" was a task — both are plain Tasks now.
    expect(items.find((i) => i.id === "venue")).toBeDefined();
    expect(items.find((i) => i.id === "t1")).toBeDefined();
  });

  it("every item is a Task with the same required fields", () => {
    for (const item of buildInitialTasks(BASE_ANSWERS)) {
      expect(typeof item.id).toBe("string");
      expect(typeof item.title).toBe("string");
      expect(typeof item.category).toBe("string");
      expect(typeof item.done).toBe("boolean");
      expect(["high", "medium", "low"]).toContain(item.priority);
      // No lingering type discriminator.
      expect("kind" in item).toBe(false);
    }
  });

  it("returns at least 19 items for an indoor wedding", () => {
    expect(buildInitialTasks(BASE_ANSWERS).length).toBeGreaterThanOrEqual(19);
  });

  it("adds both weather items for outdoor setting", () => {
    const items = buildInitialTasks({ ...BASE_ANSWERS, setting: "outdoor" as const });
    const tent = items.find((i) => i.id === "tent_weather");
    expect(tent?.flag).toMatch(/outdoor/i);
    expect(items.find((i) => i.id === "t_tent")?.flag).toMatch(/outdoor/i);
  });

  it("adds weather items for mixed setting", () => {
    const items = buildInitialTasks({ ...BASE_ANSWERS, setting: "mixed" as const });
    expect(items.find((i) => i.id === "tent_weather")).toBeDefined();
  });

  it("does NOT add weather items for indoor setting", () => {
    const items = buildInitialTasks(BASE_ANSWERS);
    expect(items.find((i) => i.id === "tent_weather")).toBeUndefined();
    expect(items.find((i) => i.id === "t_tent")).toBeUndefined();
  });

  it("flags the venue item for mountain locations", () => {
    for (const location of ["Aspen, Colorado", "Vail, CO", "Denver, Colorado"]) {
      const venue = buildInitialTasks({ ...BASE_ANSWERS, location }).find((i) => i.id === "venue");
      expect(venue?.flag).toMatch(/mountain|book early/i);
    }
  });

  it("flags the venue item for small guest count (<50)", () => {
    const items = buildInitialTasks({ ...BASE_ANSWERS, guestCount: 30 });
    expect(items.find((i) => i.id === "venue")?.flag).toMatch(/flexibility/i);
    expect(items.find((i) => i.id === "t4")?.flag).toMatch(/flexibility/i);
  });

  it("sorts furthest-out first, with undated items last", () => {
    const items = buildInitialTasks(BASE_ANSWERS);
    const ids = items.map((i) => i.id);
    expect(ids.indexOf("venue")).toBeLessThan(ids.indexOf("rsvp_deadline"));
    expect(ids.indexOf("rsvp_deadline")).toBeLessThan(ids.indexOf("wedding_day"));
    // t1/t2 carry no date at all — they sort to the end.
    expect(ids.indexOf("wedding_day")).toBeLessThan(ids.indexOf("t1"));
  });

  it("honeymoon task is high priority only when honeymoon is a priority", () => {
    const priorities = ["honeymoon", "venue", "music"] as WeddingAnswers["priorities"];
    expect(buildInitialTasks({ ...BASE_ANSWERS, priorities }).find((t) => t.id === "t7")?.priority)
      .toBe("high");
    expect(buildInitialTasks(BASE_ANSWERS).find((t) => t.id === "t7")?.priority).toBe("low");
  });

  it("budget task starts as done (already set in intake)", () => {
    expect(buildInitialTasks(BASE_ANSWERS).find((t) => t.id === "t2")?.done).toBe(true);
  });

  it("schedules derived items relative to the wedding, not on a fixed date", () => {
    const items = buildInitialTasks(BASE_ANSWERS);
    const venue = items.find((i) => i.id === "venue")!;
    expect(venue.monthsBefore).toBe(12);
    // No baked-in dueDate — the date follows the wedding day wherever it moves.
    expect(venue.dueDate).toBeUndefined();
  });
});

// ── resolveDueDate ────────────────────────────────────────────────────────────

describe("resolveDueDate", () => {
  it("prefers an explicit dueDate over any offset", () => {
    const task = { dueDate: "2026-01-05", monthsBefore: 12 };
    expect(resolveDueDate(task, "2026-06-15")).toBe("2026-01-05");
  });

  it("derives the date from monthsBefore", () => {
    expect(resolveDueDate({ monthsBefore: 12 }, "2026-06-15")).toBe("2025-06-15");
  });

  it("derives the date from daysBefore", () => {
    expect(resolveDueDate({ daysBefore: 1 }, "2026-06-15")).toBe("2026-06-14");
    expect(resolveDueDate({ daysBefore: 0 }, "2026-06-15")).toBe("2026-06-15");
  });

  it("returns undefined for an undated task", () => {
    expect(resolveDueDate({}, "2026-06-15")).toBeUndefined();
  });

  it("returns undefined for a relative task when no wedding date is set", () => {
    expect(resolveDueDate({ monthsBefore: 12 }, "")).toBeUndefined();
  });

  it("moves relative tasks when the wedding date moves", () => {
    const task = { monthsBefore: 6 };
    expect(resolveDueDate(task, "2026-06-15")).toBe("2025-12-15");
    expect(resolveDueDate(task, "2027-06-15")).toBe("2026-12-15");
  });
});

describe("describeSchedule", () => {
  it("describes month and day offsets, singular and plural", () => {
    expect(describeSchedule({ monthsBefore: 12 })).toBe("12 months before the wedding");
    expect(describeSchedule({ monthsBefore: 1 })).toBe("1 month before the wedding");
    expect(describeSchedule({ daysBefore: 1 })).toBe("1 day before the wedding");
    expect(describeSchedule({ daysBefore: 0 })).toBe("on the wedding day");
  });

  it("returns undefined for a task with an exact date or no date", () => {
    expect(describeSchedule({})).toBeUndefined();
  });
});

// ── mergePlanTasks / legacy milestone adoption ────────────────────────────────

describe("mergePlanTasks", () => {
  const seed = buildInitialTasks(BASE_ANSWERS);

  it("keeps the store copy when an id exists in both", () => {
    const stored: Task = { ...seed.find((t) => t.id === "venue")!, done: true };
    const merged = mergePlanTasks([stored], seed);
    expect(merged.filter((t) => t.id === "venue")).toHaveLength(1);
    expect(merged.find((t) => t.id === "venue")?.done).toBe(true);
  });

  it("includes seed tasks the store has never touched", () => {
    expect(mergePlanTasks([], seed)).toHaveLength(seed.length);
  });

  it("drops a removed seed task rather than re-seeding it", () => {
    const merged = mergePlanTasks([], seed, ["venue"]);
    expect(merged.find((t) => t.id === "venue")).toBeUndefined();
    expect(merged).toHaveLength(seed.length - 1);
  });

  it("drops a removed task that was already persisted", () => {
    const stored: Task = { ...seed.find((t) => t.id === "venue")!, done: true };
    expect(mergePlanTasks([stored], seed, ["venue"]).find((t) => t.id === "venue"))
      .toBeUndefined();
  });

  it("keeps everything when nothing has been removed", () => {
    expect(mergePlanTasks([], seed, [])).toHaveLength(seed.length);
  });
});

describe("assigneeSuggestions", () => {
  it("offers the couple plus Both", () => {
    expect(assigneeSuggestions(BASE_ANSWERS)).toEqual(["Louis", "Alex", "Both"]);
  });

  it("drops the partner slot when no name is set yet", () => {
    expect(assigneeSuggestions({ partnerName: "   " })).toEqual(["Louis", "Both"]);
  });
});

describe("adoptLegacyMilestoneDoneIds", () => {
  it("materialises completed milestones as done tasks", () => {
    const tasks = adoptLegacyMilestoneDoneIds(BASE_ANSWERS, [], ["venue", "catering"]);
    expect(tasks.map((t) => t.id).sort()).toEqual(["catering", "venue"]);
    expect(tasks.every((t) => t.done)).toBe(true);
  });

  it("does not clobber a task the store already has", () => {
    const existing: Task = {
      id: "venue", title: "Book your venue", category: "Venue",
      priority: "high", done: false, monthsBefore: 12,
    };
    const tasks = adoptLegacyMilestoneDoneIds(BASE_ANSWERS, [existing], ["venue"]);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].done).toBe(false);
  });

  it("ignores ids that match no seed task", () => {
    expect(adoptLegacyMilestoneDoneIds(BASE_ANSWERS, [], ["not_a_milestone"])).toEqual([]);
  });

  it("is a no-op with no answers or no done ids", () => {
    expect(adoptLegacyMilestoneDoneIds(null, [], ["venue"])).toEqual([]);
    expect(adoptLegacyMilestoneDoneIds(BASE_ANSWERS, [], [])).toEqual([]);
  });
});

// ── buildBudgetCategories ─────────────────────────────────────────────────────

describe("buildBudgetCategories", () => {
  it("returns exactly 10 categories", () => {
    const cats = buildBudgetCategories(BASE_ANSWERS);
    expect(cats).toHaveLength(10);
  });

  it("all percentages sum to ~100", () => {
    const cats = buildBudgetCategories(BASE_ANSWERS);
    const total = cats.reduce((s, c) => s + c.percentage, 0);
    expect(total).toBeCloseTo(100, 0);
  });

  it("boosts photography % when photography is a priority", () => {
    const answers = { ...BASE_ANSWERS, priorities: ["photography", "venue", "food"] as WeddingAnswers["priorities"] };
    const cats = buildBudgetCategories(answers);
    const baseline = buildBudgetCategories({ ...BASE_ANSWERS, priorities: ["venue", "music", "flowers"] as WeddingAnswers["priorities"] });
    const photoActual = cats.find((c) => c.id === "photography")!.percentage;
    const photoBaseline = baseline.find((c) => c.id === "photography")!.percentage;
    expect(photoActual).toBeGreaterThan(photoBaseline);
  });

  it("boosts catering % when food is a priority", () => {
    const answers = { ...BASE_ANSWERS, priorities: ["food", "venue", "music"] as WeddingAnswers["priorities"] };
    const cats = buildBudgetCategories(answers);
    const baseline = buildBudgetCategories({ ...BASE_ANSWERS, priorities: ["venue", "music", "flowers"] as WeddingAnswers["priorities"] });
    const cateringActual = cats.find((c) => c.id === "catering")!.percentage;
    const cateringBaseline = baseline.find((c) => c.id === "catering")!.percentage;
    expect(cateringActual).toBeGreaterThan(cateringBaseline);
  });

  it("includes luxury note for 100k+ budget", () => {
    const answers = { ...BASE_ANSWERS, budget: 150_000, priorities: ["venue", "music", "flowers"] as WeddingAnswers["priorities"] };
    const cats = buildBudgetCategories(answers);
    const photo = cats.find((c) => c.id === "photography")!;
    const hasLuxuryNote = photo.adjustments.some((a) => /luxury/i.test(a.reason));
    expect(hasLuxuryNote).toBe(true);
  });

  it("amounts match percentages × total budget", () => {
    const cats = buildBudgetCategories(BASE_ANSWERS);
    for (const cat of cats) {
      const expected = Math.round((cat.percentage / 100) * BASE_ANSWERS.budget);
      expect(cat.amount).toBe(expected);
    }
  });

  it("all categories start with spent = 0", () => {
    const cats = buildBudgetCategories(BASE_ANSWERS);
    for (const cat of cats) {
      expect(cat.spent).toBe(0);
    }
  });

  it("all categories have a baselinePercentage", () => {
    const cats = buildBudgetCategories(BASE_ANSWERS);
    for (const cat of cats) {
      expect(typeof cat.baselinePercentage).toBe("number");
      expect(cat.baselinePercentage).toBeGreaterThan(0);
    }
  });

  it("all categories have a non-empty description", () => {
    const cats = buildBudgetCategories(BASE_ANSWERS);
    for (const cat of cats) {
      expect(cat.description).toBeTruthy();
      expect(cat.description!.length).toBeGreaterThan(20);
    }
  });

  it("every description includes the allocated dollar amount", () => {
    const cats = buildBudgetCategories(BASE_ANSWERS);
    for (const cat of cats) {
      // Each description should start with the ~$X,XXX amount prefix
      expect(cat.description).toMatch(/^~\$[\d,]+/);
    }
  });

  it("description amount matches the category amount", () => {
    const cats = buildBudgetCategories(BASE_ANSWERS);
    for (const cat of cats) {
      const expected = `~$${cat.amount.toLocaleString()}`;
      expect(cat.description).toMatch(expected);
    }
  });

  it("venue description is context-aware for large guest count", () => {
    const cats = buildBudgetCategories({ ...BASE_ANSWERS, guestCount: 200 });
    const venue = cats.find((c) => c.id === "venue")!;
    expect(venue.description).toMatch(/200/);
    expect(venue.description).toMatch(/capacity/i);
  });

  it("venue description mentions flexibility for small guest count", () => {
    const cats = buildBudgetCategories({ ...BASE_ANSWERS, guestCount: 30 });
    const venue = cats.find((c) => c.id === "venue")!;
    expect(venue.description).toMatch(/smaller/i);
  });

  it("catering description includes per-person cost estimate", () => {
    const cats = buildBudgetCategories(BASE_ANSWERS);
    const catering = cats.find((c) => c.id === "catering")!;
    expect(catering.description).toMatch(/\/person/i);
  });

  it("flowers description mentions bouquet count and guest-scaled centerpieces", () => {
    const cats = buildBudgetCategories({ ...BASE_ANSWERS, guestCount: 120 });
    const flowers = cats.find((c) => c.id === "flowers")!;
    // 120 guests → ~8 bouquets, ~15 centerpieces
    expect(flowers.description).toMatch(/bouquet/i);
    expect(flowers.description).toMatch(/centerpiece/i);
  });

  it("photography description notes priority when photography is a priority", () => {
    const answers = { ...BASE_ANSWERS, priorities: ["photography", "venue", "food"] as WeddingAnswers["priorities"] };
    const cats = buildBudgetCategories(answers);
    const photo = cats.find((c) => c.id === "photography")!;
    expect(photo.description).toMatch(/top priorit/i);
  });

  it("luxury budget descriptions include luxury-tier copy", () => {
    const answers = { ...BASE_ANSWERS, budget: 150_000, priorities: ["venue", "music", "flowers"] as WeddingAnswers["priorities"] };
    const cats = buildBudgetCategories(answers);
    const flowers = cats.find((c) => c.id === "flowers")!;
    expect(flowers.description).toMatch(/luxury/i);
    const music = cats.find((c) => c.id === "music")!;
    expect(music.description).toMatch(/live band/i);
  });
});

// ── Exact wedding dates ───────────────────────────────────────────────────────

describe("date arithmetic with exact wedding dates", () => {
  it("derives item dates from the exact day the couple picked", () => {
    const answers = { ...BASE_ANSWERS, date: "2027-09-04", dateIsExact: true };
    const items = buildInitialTasks(answers);
    const on = (id: string) => resolveDueDate(items.find((i) => i.id === id)!, answers.date);
    expect(on("wedding_day")).toBe("2027-09-04");
    expect(on("rehearsal")).toBe("2027-09-03");
    expect(on("venue")).toBe("2026-09-04");
    expect(on("rsvp_deadline")).toBe("2027-07-04");
    expect(on("t4")).toBe("2026-09-04");
    expect(on("t7")).toBe("2027-03-04");
  });

  it("clamps to the last day of the month instead of overflowing", () => {
    // Mar 31 minus one month is Feb 28 — never Mar 3.
    const answers = { ...BASE_ANSWERS, date: "2027-03-31", dateIsExact: true };
    const items = buildInitialTasks(answers);
    expect(resolveDueDate(items.find((i) => i.id === "final_headcount")!, answers.date))
      .toBe("2027-02-28");
  });

  it("leaves dates unresolved when no wedding date is set", () => {
    const items = buildInitialTasks({ ...BASE_ANSWERS, date: "" });
    expect(resolveDueDate(items.find((i) => i.id === "venue")!, "")).toBeUndefined();
    expect(resolveDueDate(items.find((i) => i.id === "rehearsal")!, "")).toBeUndefined();
  });
});
