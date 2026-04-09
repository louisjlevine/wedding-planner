import type { Guest, GuestRelationship, GuestLocation } from "./types";

// ── Attendance probability table ──────────────────────────────────────────────

const PROB: Record<GuestRelationship, Record<GuestLocation, number>> = {
  family:       { local: 0.95, out_of_town: 0.75 },
  close_friend: { local: 0.90, out_of_town: 0.65 },
  friend:       { local: 0.75, out_of_town: 0.45 },
  acquaintance: { local: 0.50, out_of_town: 0.25 },
};

const DEFAULT_PROB = 0.70; // no relationship/location set

export function getBaseProbability(guest: Guest): number {
  if (guest.relationship && guest.guestLocation) {
    return PROB[guest.relationship][guest.guestLocation];
  }
  return DEFAULT_PROB;
}

/** Expected headcount contribution from a single guest entry (accounts for totalGuests) */
export function guestExpectedCount(guest: Guest): number {
  const p = getBaseProbability(guest);
  let factor: number;
  switch (guest.rsvp) {
    case "yes":   factor = 1.0;     break;
    case "no":    factor = 0;       break;
    case "maybe": factor = p * 0.5; break;
    default:      factor = p;       break; // pending
  }
  return factor * guest.totalGuests;
}

/** Total estimated headcount across all guests */
export function estimatedAttendance(guests: Guest[]): number {
  return Math.round(guests.reduce((sum, g) => sum + guestExpectedCount(g), 0));
}

export const RELATIONSHIP_LABELS: Record<GuestRelationship, string> = {
  family:       "Family",
  close_friend: "Close friend",
  friend:       "Friend",
  acquaintance: "Acquaintance",
};

export const LOCATION_LABELS: Record<GuestLocation, string> = {
  local:       "Local",
  out_of_town: "Out of town",
};
