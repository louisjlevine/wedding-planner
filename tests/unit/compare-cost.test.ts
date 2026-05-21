import { describe, it, expect } from "vitest";
import {
  computeVenueCost,
  computeCateringCost,
  computeBarCost,
  computeMiscCost,
  computeScenario,
  resolvePackage,
} from "@/lib/compare-cost";
import type { Vendor, CatererPackage, MiscLineItem } from "@/lib/types";

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

  it("via-caterer multiplies per-person by guest count (legacy direct entry)", () => {
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

  it("via-caterer pulls pricing from a caterer's barCostModel", () => {
    const caterer: Vendor = {
      id: "c1",
      name: "Forage",
      category: "Catering",
      status: "considering",
      barCostModel: { base: 500, perPerson: 25 },
    };
    const r = computeBarCost({ mode: "via_caterer" }, 100, caterer);
    expect(r.base).toBe(500);
    expect(r.perPerson).toBe(2500);
    expect(r.total).toBe(3000);
    expect(r.vendorId).toBe("c1");
  });

  it("via-caterer pulls pricing from a Bar vendor's costModel", () => {
    const bar: Vendor = {
      id: "b1",
      name: "PourHouse",
      category: "Bar",
      status: "considering",
      costModel: { base: 300, perPerson: 55 },
    };
    const r = computeBarCost({ mode: "via_caterer" }, 100, bar);
    expect(r.base).toBe(300);
    expect(r.perPerson).toBe(5500);
    expect(r.total).toBe(5800);
  });
});

describe("computeMiscCost", () => {
  function withMisc(category: string, items: MiscLineItem[]): Vendor {
    return {
      id: `${category}-misc`,
      name: category,
      category,
      status: "considering",
      miscLineItems: items,
    };
  }

  it("counts only the venue's misc items — caterer-side data is ignored to avoid double counts", () => {
    const venue = withMisc("Venue", [
      { id: "m1", label: "Cleanup", cost: 500 },
      { id: "m2", label: "Chairs",  cost: 300 },
    ]);
    const caterer = withMisc("Catering", [
      { id: "m1", label: "Cleanup", cost: 700 }, // same library id — pre-fix this would double up
      { id: "m3", label: "Vendor meals", cost: 240 },
    ]);
    const r = computeMiscCost(venue, caterer);
    expect(r.total).toBe(500 + 300);
    expect(r.items).toHaveLength(2);
  });

  it("dedupes within the venue if the same library id appears twice", () => {
    const venue = withMisc("Venue", [
      { id: "m1", label: "Cleanup", cost: 500 },
      { id: "m1", label: "Cleanup", cost: 700 }, // duplicate id
    ]);
    const r = computeMiscCost(venue, undefined);
    expect(r.total).toBe(500);
    expect(r.items).toHaveLength(1);
  });

  it("dedupes orphan entries that share a label but have a different id", () => {
    // Pre-shared-library data could leave behind entries with one-off ids
    // that match a properly-mapped row by label. These used to double the
    // misc subtotal on Compare; now we drop the second occurrence.
    const venue = withMisc("Venue", [
      { id: "lib-doc",      label: "DOC",       cost: 2750 },
      { id: "orphan-doc",   label: "DOC",       cost: 2750 },
      { id: "lib-transport", label: "Transport", cost: 2000 },
      { id: "orphan-trans", label: "transport", cost: 2000 }, // case-insensitive too
    ]);
    const r = computeMiscCost(venue, undefined);
    expect(r.total).toBe(2750 + 2000);
    expect(r.items).toHaveLength(2);
  });

  it("returns zero total when no misc items are set", () => {
    const r = computeMiscCost(undefined, undefined);
    expect(r.total).toBe(0);
    expect(r.items).toEqual([]);
  });

  it("ignores non-finite costs", () => {
    const venue = withMisc("Venue", [
      { id: "m1", label: "Bad",  cost: Number.NaN },
      { id: "m2", label: "Good", cost: 100 },
    ]);
    const r = computeMiscCost(venue, undefined);
    expect(r.total).toBe(100);
    expect(r.items).toHaveLength(1);
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

  it("includes misc line items from the venue (only) in the total", () => {
    const v: Vendor = {
      ...venue({ base: 10000, hoursIncluded: 8 }),
      miscLineItems: [{ id: "m1", label: "Cleanup", cost: 500 }],
    };
    const c: Vendor = {
      ...legacyCaterer(100),
      // Caterer-side misc is preserved on the record but no longer summed.
      miscLineItems: [{ id: "m2", label: "Vendor meals", cost: 200 }],
    };
    const s = computeScenario(
      v,
      c,
      undefined,
      { mode: "self_host", flatBudget: 1000 },
      50,
      8
    );
    // venue 10000 + catering 100*50 + bar 1000 + misc 500
    expect(s.total).toBe(10000 + 5000 + 1000 + 500);
    expect(s.misc.total).toBe(500);
  });
});
