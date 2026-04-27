import { describe, it, expect } from "vitest";
import {
  computeVenueCost,
  computePerPersonCost,
  computeBarCost,
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

describe("computeBarCost", () => {
  it("self-host returns the flat budget regardless of guest count", () => {
    const r = computeBarCost({ mode: "self_host", flatBudget: 2500 }, 200);
    expect(r.total).toBe(2500);
    expect(r.hasData).toBe(true);
  });

  it("via-caterer multiplies per-person by guest count", () => {
    const r = computeBarCost({ mode: "via_caterer", perPerson: 25 }, 120);
    expect(r.total).toBe(3000);
    expect(r.hasData).toBe(true);
  });

  it("returns zero when fields are missing", () => {
    const a = computeBarCost({ mode: "self_host" }, 100);
    const b = computeBarCost({ mode: "via_caterer" }, 100);
    expect(a.total).toBe(0);
    expect(b.total).toBe(0);
    expect(a.hasData).toBe(false);
    expect(b.hasData).toBe(false);
  });
});

describe("computeScenario", () => {
  it("sums venue + catering + bar (self-host) into a single total", () => {
    const v = venue({ base: 12000, hoursIncluded: 8, overtimeHourly: 750 });
    const s = computeScenario(
      v,
      caterer(145),
      { mode: "self_host", flatBudget: 6000 },
      120,
      10
    );
    // venue 12000 + 2*750 = 13500
    // catering 145*120 = 17400
    // bar self-host = 6000
    expect(s.total).toBe(13500 + 17400 + 6000);
  });

  it("sums venue + catering + bar (via-caterer) into a single total", () => {
    const v = venue({ base: 12000, hoursIncluded: 8 });
    const s = computeScenario(
      v,
      caterer(145),
      { mode: "via_caterer", perPerson: 25 },
      100,
      8
    );
    // venue 12000 + catering 14500 + bar 25*100 = 2500
    expect(s.total).toBe(12000 + 14500 + 2500);
  });

  it("treats undefined vendor slots as zero", () => {
    const v = venue({ base: 12000, hoursIncluded: 8 });
    const s = computeScenario(
      v,
      undefined,
      { mode: "self_host", flatBudget: 1000 },
      100,
      8
    );
    expect(s.total).toBe(12000 + 1000);
  });
});
