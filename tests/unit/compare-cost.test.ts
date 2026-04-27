import { describe, it, expect } from "vitest";
import {
  computeVenueCost,
  computePerPersonCost,
  computeScenario,
} from "@/lib/compare-cost";
import type { Vendor } from "@/lib/types";

function venue(overrides: Partial<Vendor["costModel"]>): Vendor {
  return {
    id: "v",
    name: "The Barn",
    category: "Venue",
    status: "considering",
    costModel: { ...overrides },
  };
}

function caterer(perPerson: number, base = 0): Vendor {
  return {
    id: `c-${perPerson}`,
    name: "Forage",
    category: "Catering",
    status: "considering",
    costModel: { base, perPerson },
  };
}

function bar(perPerson: number): Vendor {
  return {
    id: `b-${perPerson}`,
    name: "Open Bar",
    category: "Bar",
    status: "considering",
    costModel: { perPerson },
  };
}

describe("computeVenueCost", () => {
  it("returns base cost only when event fits within included hours", () => {
    const v = venue({ base: 12000, hoursIncluded: 8, overtimeHourly: 750 });
    const c = computeVenueCost(v, 8);
    expect(c.base).toBe(12000);
    expect(c.overtime).toBe(0);
    expect(c.total).toBe(12000);
  });

  it("adds overtime for hours past the included block", () => {
    const v = venue({ base: 12000, hoursIncluded: 8, overtimeHourly: 750 });
    const c = computeVenueCost(v, 10);
    expect(c.overtime).toBe(1500);
    expect(c.total).toBe(13500);
  });

  it("does not subtract for fewer-than-included hours", () => {
    const v = venue({ base: 12000, hoursIncluded: 8, overtimeHourly: 750 });
    const c = computeVenueCost(v, 4);
    expect(c.overtime).toBe(0);
    expect(c.total).toBe(12000);
  });

  it("treats missing costModel as zero", () => {
    const c = computeVenueCost(undefined, 8);
    expect(c.total).toBe(0);
    expect(c.hasData).toBe(false);
  });
});

describe("computePerPersonCost", () => {
  it("multiplies per-person rate by guest count", () => {
    const c = computePerPersonCost(caterer(145), 120);
    expect(c.perPerson).toBe(17400);
    expect(c.total).toBe(17400);
  });

  it("adds a base fee when present", () => {
    const c = computePerPersonCost(caterer(100, 500), 50);
    expect(c.total).toBe(5500);
  });

  it("does not error on negative guest counts", () => {
    const c = computePerPersonCost(caterer(100), -10);
    expect(c.total).toBe(0);
  });
});

describe("computeScenario", () => {
  it("sums venue + catering + bar into a single total", () => {
    const v = venue({ base: 12000, hoursIncluded: 8, overtimeHourly: 750 });
    const s = computeScenario(v, caterer(145), bar(55), 120, 10);
    // venue 12000 + 2*750 = 13500
    // catering 145*120 = 17400
    // bar 55*120 = 6600
    expect(s.total).toBe(13500 + 17400 + 6600);
  });

  it("treats undefined slots as zero so partial selections still total", () => {
    const v = venue({ base: 12000, hoursIncluded: 8 });
    const s = computeScenario(v, undefined, bar(55), 100, 8);
    expect(s.total).toBe(12000 + 5500);
  });
});
