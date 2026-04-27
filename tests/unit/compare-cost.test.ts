import { describe, it, expect } from "vitest";
import {
  computeVenueCost,
  computeCateringCost,
  computeBarCost,
  computeScenario,
  resolvePackage,
} from "@/lib/compare-cost";
import type { Vendor, CatererPackage } from "@/lib/types";

function venue(overrides: Partial<NonNullable<Vendor["costModel"]>>): Vendor {
  return {
    id: "v",
    name: "The Barn",
    category: "Venue",
    status: "considering",
    costModel: { ...overrides },
  };
}

// Legacy caterer (no packages) — relies on costModel.perPerson fallback.
function legacyCaterer(perPerson: number, base = 0): Vendor {
  return {
    id: `c-${perPerson}`,
    name: "Forage",
    category: "Catering",
    status: "considering",
    costModel: { base, perPerson },
  };
}

function packagedCaterer(packages: CatererPackage[]): Vendor {
  return {
    id: "c-pkg",
    name: "Forage",
    category: "Catering",
    status: "considering",
    packages,
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

describe("computeCateringCost (legacy fallback)", () => {
  it("multiplies per-person rate by guest count", () => {
    const c = computeCateringCost(legacyCaterer(145), undefined, 120);
    expect(c.perPerson).toBe(17400);
    expect(c.total).toBe(17400);
  });

  it("adds a base fee when present", () => {
    const c = computeCateringCost(legacyCaterer(100, 500), undefined, 50);
    expect(c.total).toBe(5500);
  });

  it("does not error on negative guest counts", () => {
    const c = computeCateringCost(legacyCaterer(100), undefined, -10);
    expect(c.total).toBe(0);
  });
});

describe("computeCateringCost (packages)", () => {
  it("uses the selected package's per-person and base", () => {
    const caterer = packagedCaterer([
      { id: "p1", name: "Plated",   perPerson: 145, base: 500 },
      { id: "p2", name: "Buffet",   perPerson: 95,  base: 0 },
      { id: "p3", name: "Premium",  perPerson: 200 },
    ]);
    const c = computeCateringCost(caterer, "p2", 120);
    expect(c.base).toBe(0);
    expect(c.perPerson).toBe(95 * 120);
    expect(c.total).toBe(95 * 120);
  });

  it("falls back to the first package when no packageId is provided", () => {
    const caterer = packagedCaterer([
      { id: "p1", name: "Plated", perPerson: 145 },
      { id: "p2", name: "Buffet", perPerson: 95 },
    ]);
    const c = computeCateringCost(caterer, undefined, 100);
    expect(c.total).toBe(145 * 100);
  });

  it("falls back to the first package when packageId is unknown", () => {
    const caterer = packagedCaterer([
      { id: "p1", name: "Plated", perPerson: 145 },
    ]);
    const c = computeCateringCost(caterer, "missing", 50);
    expect(c.total).toBe(145 * 50);
  });

  it("treats undefined caterer as zero", () => {
    const c = computeCateringCost(undefined, undefined, 100);
    expect(c.total).toBe(0);
    expect(c.hasData).toBe(false);
  });
});

describe("resolvePackage", () => {
  it("returns the matching package by id", () => {
    const caterer = packagedCaterer([
      { id: "p1", name: "Plated", perPerson: 145 },
      { id: "p2", name: "Buffet", perPerson: 95 },
    ]);
    expect(resolvePackage(caterer, "p2")?.name).toBe("Buffet");
  });

  it("returns the first package when id is missing", () => {
    const caterer = packagedCaterer([
      { id: "p1", name: "Plated", perPerson: 145 },
    ]);
    expect(resolvePackage(caterer, undefined)?.name).toBe("Plated");
  });

  it("returns undefined when there are no packages", () => {
    expect(resolvePackage(legacyCaterer(145), "any")).toBeUndefined();
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
      legacyCaterer(145),
      undefined,
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
      legacyCaterer(145),
      undefined,
      { mode: "via_caterer", perPerson: 25 },
      100,
      8
    );
    // venue 12000 + catering 14500 + bar 25*100 = 2500
    expect(s.total).toBe(12000 + 14500 + 2500);
  });

  it("uses package pricing when caterer has packages", () => {
    const v = venue({ base: 10000, hoursIncluded: 8 });
    const caterer = packagedCaterer([
      { id: "p1", name: "Plated", perPerson: 150 },
      { id: "p2", name: "Buffet", perPerson: 90 },
    ]);
    const s = computeScenario(
      v,
      caterer,
      "p2",
      { mode: "self_host", flatBudget: 2000 },
      100,
      8
    );
    // venue 10000 + catering 90*100 + bar 2000
    expect(s.total).toBe(10000 + 9000 + 2000);
  });

  it("treats undefined catering as zero", () => {
    const v = venue({ base: 12000, hoursIncluded: 8 });
    const s = computeScenario(
      v,
      undefined,
      undefined,
      { mode: "self_host", flatBudget: 1000 },
      100,
      8
    );
    expect(s.total).toBe(12000 + 1000);
  });
});
