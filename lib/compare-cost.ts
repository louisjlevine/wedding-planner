import type { Vendor } from "./types";

export interface CostBreakdown {
  base: number;          // venue rental or per-person × guests
  overtime: number;      // venue overtime hours × rate (0 for non-venue)
  perPerson: number;     // catering / bar per-person subtotal (0 for venue)
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

export function computePerPersonCost(
  vendor: Vendor | undefined,
  guestCount: number
): CostBreakdown {
  if (!vendor?.costModel) return EMPTY;
  const { base = 0, perPerson = 0 } = vendor.costModel;
  const personSubtotal = perPerson * Math.max(0, guestCount);
  return {
    base,
    overtime: 0,
    perPerson: personSubtotal,
    total: base + personSubtotal,
    hasData: base > 0 || perPerson > 0,
  };
}

export interface ScenarioTotal {
  venue: CostBreakdown;
  catering: CostBreakdown;
  bar: CostBreakdown;
  total: number;
}

export function computeScenario(
  venue: Vendor | undefined,
  catering: Vendor | undefined,
  bar: Vendor | undefined,
  guestCount: number,
  hours: number
): ScenarioTotal {
  const v = computeVenueCost(venue, hours);
  const c = computePerPersonCost(catering, guestCount);
  const b = computePerPersonCost(bar, guestCount);
  return {
    venue: v,
    catering: c,
    bar: b,
    total: v.total + c.total + b.total,
  };
}
