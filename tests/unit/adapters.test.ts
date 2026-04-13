import { describe, it, expect } from "vitest";
import {
  buildTimeline,
  buildBudgetCategories,
  buildInitialTasks,
} from "@/lib/plan-adapters";
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

// ── buildTimeline ─────────────────────────────────────────────────────────────

describe("buildTimeline", () => {
  it("returns at least 12 items for an indoor wedding", () => {
    const items = buildTimeline(BASE_ANSWERS);
    expect(items.length).toBeGreaterThanOrEqual(12);
  });

  it("adds tent/weather item for outdoor setting", () => {
    const answers = { ...BASE_ANSWERS, setting: "outdoor" as const };
    const items = buildTimeline(answers);
    const tent = items.find((i) => i.id === "tent_weather");
    expect(tent).toBeDefined();
    expect(tent?.flag).toMatch(/outdoor/i);
  });

  it("adds tent/weather item for mixed setting", () => {
    const answers = { ...BASE_ANSWERS, setting: "mixed" as const };
    const items = buildTimeline(answers);
    expect(items.find((i) => i.id === "tent_weather")).toBeDefined();
  });

  it("does NOT add tent item for indoor setting", () => {
    const items = buildTimeline(BASE_ANSWERS);
    expect(items.find((i) => i.id === "tent_weather")).toBeUndefined();
  });

  it("flags venue item for mountain location", () => {
    const answers = { ...BASE_ANSWERS, location: "Aspen, Colorado" };
    const venue = buildTimeline(answers).find((i) => i.id === "venue");
    expect(venue?.flag).toMatch(/mountain|book early/i);
  });

  it("flags venue item for vail location", () => {
    const answers = { ...BASE_ANSWERS, location: "Vail, CO" };
    const venue = buildTimeline(answers).find((i) => i.id === "venue");
    expect(venue?.flag).toMatch(/mountain|book early/i);
  });

  it("flags venue item for colorado location", () => {
    const answers = { ...BASE_ANSWERS, location: "Denver, Colorado" };
    const venue = buildTimeline(answers).find((i) => i.id === "venue");
    expect(venue?.flag).toMatch(/mountain|book early/i);
  });

  it("flags venue for small guest count (<50)", () => {
    const answers = { ...BASE_ANSWERS, location: "New York, NY", guestCount: 30 };
    const venue = buildTimeline(answers).find((i) => i.id === "venue");
    expect(venue?.flag).toMatch(/flexibility/i);
  });

  it("returns items sorted by monthsBefore descending", () => {
    const items = buildTimeline(BASE_ANSWERS);
    for (let i = 1; i < items.length; i++) {
      expect(items[i].monthsBefore).toBeLessThanOrEqual(items[i - 1].monthsBefore);
    }
  });

  it("wedding_day targetDate equals answers.date", () => {
    const items = buildTimeline(BASE_ANSWERS);
    const weddingDay = items.find((i) => i.id === "wedding_day");
    expect(weddingDay?.targetDate).toBe(BASE_ANSWERS.date);
  });

  it("rehearsal is 1 day before wedding date", () => {
    const items = buildTimeline(BASE_ANSWERS);
    const rehearsal = items.find((i) => i.id === "rehearsal");
    expect(rehearsal?.targetDate).toBe("2026-06-14");
  });

  it("all items have required fields", () => {
    const items = buildTimeline(BASE_ANSWERS);
    for (const item of items) {
      expect(typeof item.id).toBe("string");
      expect(typeof item.title).toBe("string");
      expect(typeof item.targetDate).toBe("string");
      expect(typeof item.monthsBefore).toBe("number");
      expect(typeof item.category).toBe("string");
      expect(typeof item.done).toBe("boolean");
    }
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

// ── buildInitialTasks ─────────────────────────────────────────────────────────

describe("buildInitialTasks", () => {
  it("returns 7 base tasks for indoor setting", () => {
    const tasks = buildInitialTasks(BASE_ANSWERS);
    expect(tasks).toHaveLength(7);
  });

  it("adds tent task for outdoor setting", () => {
    const answers = { ...BASE_ANSWERS, setting: "outdoor" as const };
    const tasks = buildInitialTasks(answers);
    expect(tasks).toHaveLength(8);
    const tentTask = tasks.find((t) => t.id === "t_tent");
    expect(tentTask).toBeDefined();
    expect(tentTask?.flag).toMatch(/outdoor/i);
  });

  it("adds tent task for mixed setting", () => {
    const answers = { ...BASE_ANSWERS, setting: "mixed" as const };
    expect(buildInitialTasks(answers)).toHaveLength(8);
  });

  it("honeymoon task is high priority when honeymoon is a priority", () => {
    const answers = { ...BASE_ANSWERS, priorities: ["honeymoon", "venue", "music"] as WeddingAnswers["priorities"] };
    const tasks = buildInitialTasks(answers);
    const honeymoon = tasks.find((t) => t.id === "t7")!;
    expect(honeymoon.priority).toBe("high");
  });

  it("honeymoon task is low priority when honeymoon is NOT a priority", () => {
    const tasks = buildInitialTasks(BASE_ANSWERS);
    const honeymoon = tasks.find((t) => t.id === "t7")!;
    expect(honeymoon.priority).toBe("low");
  });

  it("venue task has flexibility flag for small guest count", () => {
    const answers = { ...BASE_ANSWERS, guestCount: 25 };
    const tasks = buildInitialTasks(answers);
    const venue = tasks.find((t) => t.id === "t4")!;
    expect(venue.flag).toMatch(/flexibility/i);
  });

  it("all tasks have required fields", () => {
    const tasks = buildInitialTasks(BASE_ANSWERS);
    for (const task of tasks) {
      expect(typeof task.id).toBe("string");
      expect(typeof task.title).toBe("string");
      expect(typeof task.category).toBe("string");
      expect(typeof task.done).toBe("boolean");
      expect(["high", "medium", "low"]).toContain(task.priority);
    }
  });

  it("budget task starts as done (already set in intake)", () => {
    const tasks = buildInitialTasks(BASE_ANSWERS);
    const budgetTask = tasks.find((t) => t.id === "t2")!;
    expect(budgetTask.done).toBe(true);
  });
});
