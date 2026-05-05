import type { Guest, GuestPriority, GuestRelationship } from "./types";
import { guestExpectedCount } from "./guest-probability";

export const PRIORITY_TIERS: GuestPriority[] = ["must", "want", "ifSpace"];

export const PRIORITY_LABELS: Record<GuestPriority, string> = {
  must:    "Must invite",
  want:    "Want to invite",
  ifSpace: "If space",
};

export const PRIORITY_SHORT_LABELS: Record<GuestPriority, string> = {
  must:    "Must",
  want:    "Want",
  ifSpace: "If space",
};

const PRIORITY_RANK: Record<GuestPriority, number> = {
  must:    0,
  want:    1,
  ifSpace: 2,
};

const RELATIONSHIP_RANK: Record<GuestRelationship, number> = {
  family:       0,
  close_friend: 1,
  friend:       2,
  acquaintance: 3,
};

/**
 * Pre-seed a priority tier from a guest's relationship. Used by the v5 store
 * migration to backfill `priority` on guests created before the field existed,
 * and as a fallback when reading guests imported without an explicit tier.
 */
export function priorityFromRelationship(rel?: GuestRelationship): GuestPriority {
  if (rel === "family" || rel === "close_friend") return "must";
  if (rel === "acquaintance") return "ifSpace";
  return "want";
}

export function effectivePriority(g: Guest): GuestPriority {
  return g.priority ?? priorityFromRelationship(g.relationship);
}

/**
 * Stable sort: priority tier (must → want → ifSpace), then relationship
 * (family → close_friend → friend → acquaintance → unset), then name A→Z.
 * The first two are how we want guests ranked when applying a cutoff;
 * name is the tiebreaker so the visual order is deterministic.
 */
export function compareGuestRank(a: Guest, b: Guest): number {
  const pa = PRIORITY_RANK[effectivePriority(a)];
  const pb = PRIORITY_RANK[effectivePriority(b)];
  if (pa !== pb) return pa - pb;
  const ra = a.relationship ? RELATIONSHIP_RANK[a.relationship] : 99;
  const rb = b.relationship ? RELATIONSHIP_RANK[b.relationship] : 99;
  if (ra !== rb) return ra - rb;
  return a.name.localeCompare(b.name);
}

export function rankedGuests(guests: Guest[]): Guest[] {
  return [...guests].sort(compareGuestRank);
}

export type CutoffMode = "attending" | "invited";

export interface CutoffResult {
  /** Set of guest ids that fall below the cutoff (would be cut). */
  cutIds: Set<string>;
  /** Sum of `totalGuests` across kept entries. */
  invitedSeats: number;
  /** Estimated attending headcount across kept entries. */
  estimatedAttending: number;
}

/**
 * Walk the ranked list top-down, keeping guests as long as the running total
 * stays below `target`. Once the next guest would push us past `target`, every
 * remaining guest is marked as cut. `mode` controls whether we count seats
 * (sum of totalGuests) or expected attendance (probability-weighted).
 *
 * Returns an empty cut set when target is null/undefined/<=0 — i.e. cutoff off.
 */
export function applyCutoff(
  guests: Guest[],
  target: number | null | undefined,
  mode: CutoffMode = "attending",
): CutoffResult {
  const ranked = rankedGuests(guests);
  const cutIds = new Set<string>();
  let invitedSeats = 0;
  let estimatedAttending = 0;

  if (!target || target <= 0) {
    for (const g of ranked) {
      invitedSeats += g.totalGuests;
      estimatedAttending += guestExpectedCount(g);
    }
    return {
      cutIds,
      invitedSeats,
      estimatedAttending: Math.round(estimatedAttending),
    };
  }

  let running = 0;
  let cutting = false;
  for (const g of ranked) {
    const contribution = mode === "invited" ? g.totalGuests : guestExpectedCount(g);
    if (cutting || running + contribution > target) {
      cutting = true;
      cutIds.add(g.id);
      continue;
    }
    running += contribution;
    invitedSeats += g.totalGuests;
    estimatedAttending += guestExpectedCount(g);
  }

  return {
    cutIds,
    invitedSeats,
    estimatedAttending: Math.round(estimatedAttending),
  };
}
