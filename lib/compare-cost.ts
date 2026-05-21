import type { Vendor, BarMode, CatererPackage } from "./types";

export interface CostBreakdown {
  base: number;          // venue rental or per-person × guests
  overtime: number;      // venue overtime hours × rate (0 for non-venue)
  perPerson: number;     // catering per-person subtotal (0 for venue)
  total: number;
  // diagnostic: are any required fields missing?
  hasData: boolean;
}

const EMPTY: CostBreakdown = {
  base: 0,
  overtime: 0,
  perPerson: 0,
  total: 0,
  hasData: false,
};

export function computeVenueCost(
  vendor: Vendor | undefined,
  hours: number
): CostBreakdown {
  if (!vendor?.costModel) return EMPTY;
  const { base = 0, hoursIncluded = 0, overtimeHourly = 0 } = vendor.costModel;
  const extra = Math.max(0, hours - hoursIncluded);
  const overtime = extra * overtimeHourly;
  return {
    base,
    overtime,
    perPerson: 0,
    total: base + overtime,
    hasData: base > 0 || overtimeHourly > 0,
  };
}

// Pick a package by id, falling back to the first one if id is missing.
export function resolvePackage(
  vendor: Vendor | undefined,
  packageId?: string
): CatererPackage | undefined {
  if (!vendor?.packages || vendor.packages.length === 0) return undefined;
  if (packageId) {
    const found = vendor.packages.find((p) => p.id === packageId);
    if (found) return found;
  }
  return vendor.packages[0];
}

// Caterer cost from a selected package. Falls back to the legacy
// vendor.costModel.perPerson if the caterer has no packages defined yet,
// so existing single-cost caterers still work.
export function computeCateringCost(
  vendor: Vendor | undefined,
  packageId: string | undefined,
  guestCount: number
): CostBreakdown {
  if (!vendor) return EMPTY;
  const guests = Math.max(0, guestCount);
  const pkg = resolvePackage(vendor, packageId);
  if (pkg) {
    const base = pkg.base ?? 0;
    const perPerson = pkg.perPerson ?? 0;
    const personSubtotal = perPerson * guests;
    return {
      base,
      overtime: 0,
      perPerson: personSubtotal,
      total: base + personSubtotal,
      hasData: base > 0 || perPerson > 0,
    };
  }
  // Legacy fallback for caterers added before packages existed.
  if (!vendor.costModel) return EMPTY;
  const { base = 0, perPerson = 0 } = vendor.costModel;
  const personSubtotal = perPerson * guests;
  return {
    base,
    overtime: 0,
    perPerson: personSubtotal,
    total: base + personSubtotal,
    hasData: base > 0 || perPerson > 0,
  };
}

export interface BarAddon {
  mode: BarMode;
  flatBudget?: number;   // self_host
  perPerson?: number;    // via_caterer (legacy direct entry)
  base?: number;         // via_caterer (legacy direct entry)
}

export interface BarBreakdown {
  mode: BarMode;
  base: number;
  perPerson: number;     // per-person subtotal (perPerson × guests)
  total: number;
  hasData: boolean;
  vendorId?: string;
  vendorName?: string;
}

// Pull the bar pricing for the selected bar vendor. Bar-category vendors carry
// the pricing on their costModel; caterers use the separate barCostModel.
function readBarVendorPricing(vendor: Vendor | undefined): { base: number; perPerson: number } {
  if (!vendor) return { base: 0, perPerson: 0 };
  if (vendor.category === "Catering") {
    const cm = vendor.barCostModel ?? {};
    return { base: cm.base ?? 0, perPerson: cm.perPerson ?? 0 };
  }
  // Bar category (or anything else) — fall back to costModel.
  const cm = vendor.costModel ?? {};
  return { base: cm.base ?? 0, perPerson: cm.perPerson ?? 0 };
}

export function computeBarCost(addon: BarAddon, guestCount: number, barVendor?: Vendor): BarBreakdown {
  const guests = Math.max(0, guestCount);
  if (addon.mode === "self_host") {
    const total = addon.flatBudget ?? 0;
    return { mode: "self_host", base: 0, perPerson: 0, total, hasData: total > 0 };
  }
  // via_caterer — pricing comes from the chosen bar vendor; legacy direct
  // entry on the addon still works as a fallback.
  const fromVendor = readBarVendorPricing(barVendor);
  const base = fromVendor.base || (addon.base ?? 0);
  const perPersonRate = fromVendor.perPerson || (addon.perPerson ?? 0);
  const personSubtotal = perPersonRate * guests;
  const total = base + personSubtotal;
  return {
    mode: "via_caterer",
    base,
    perPerson: personSubtotal,
    total,
    hasData: total > 0,
    vendorId: barVendor?.id,
    vendorName: barVendor?.name,
  };
}

export interface MiscEntry {
  source: "venue" | "caterer";
  label: string;
  cost: number;
}

export interface MiscBreakdown {
  items: MiscEntry[];
  total: number;
}

export function computeMiscCost(
  venue: Vendor | undefined,
  catering: Vendor | undefined
): MiscBreakdown {
  const items: MiscEntry[] = [];
  for (const m of venue?.miscLineItems ?? []) {
    if (Number.isFinite(m.cost)) {
      items.push({ source: "venue", label: m.label, cost: m.cost });
    }
  }
  for (const m of catering?.miscLineItems ?? []) {
    if (Number.isFinite(m.cost)) {
      items.push({ source: "caterer", label: m.label, cost: m.cost });
    }
  }
  const total = items.reduce((sum, m) => sum + m.cost, 0);
  return { items, total };
}

export interface ScenarioTotal {
  venue: CostBreakdown;
  catering: CostBreakdown;
  bar: BarBreakdown;
  misc: MiscBreakdown;
  total: number;
}

export function computeScenario(
  venue: Vendor | undefined,
  catering: Vendor | undefined,
  packageId: string | undefined,
  bar: BarAddon,
  guestCount: number,
  hours: number,
  barVendor?: Vendor
): ScenarioTotal {
  const v = computeVenueCost(venue, hours);
  const c = computeCateringCost(catering, packageId, guestCount);
  const b = computeBarCost(bar, guestCount, barVendor);
  const m = computeMiscCost(venue, catering);
  return {
    venue: v,
    catering: c,
    bar: b,
    misc: m,
    total: v.total + c.total + b.total + m.total,
  };
}
