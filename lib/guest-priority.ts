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
 * Stable sort: priority tier (must → want → ifSpace), then the couple's
 * manual `rank` (unranked guests after ranked ones), then relationship
 * (family → close_friend → friend → acquaintance → unset), then name A→Z.
 * This is the order a cutoff is applied in; name is the final tiebreaker so
 * the visual order is deterministic.
 */
export function compareGuestRank(a: Guest, b: Guest): number {
  const pa = PRIORITY_RANK[effectivePriority(a)];
  const pb = PRIORITY_RANK[effectivePriority(b)];
  if (pa !== pb) return pa - pb;
  const ka = a.rank ?? Infinity;
  const kb = b.rank ?? Infinity;
  if (ka !== kb) return ka < kb ? -1 : 1;
  const ra = a.relationship ? RELATIONSHIP_RANK[a.relationship] : 99;
  const rb = b.relationship ? RELATIONSHIP_RANK[b.relationship] : 99;
  if (ra !== rb) return ra - rb;
  return a.name.localeCompare(b.name);
}

export function rankedGuests(guests: Guest[]): Guest[] {
  return [...guests].sort(compareGuestRank);
}

export type GuestPlacement = "before" | "after";

/**
 * Move guest `id` to sit directly before/after `targetId` in the ranked list,
 * adopting the target's priority tier (so dragging across a tier boundary
 * re-tiers the guest). Every guest is then re-ranked 0..n-1 in the new order,
 * which makes the manual order explicit and persistent.
 *
 * Returns the per-guest updates to write, or null when nothing would change.
 */
export function moveGuest(
  guests: Guest[],
  id: string,
  targetId: string,
  placement: GuestPlacement,
): Record<string, Partial<Guest>> | null {
  if (id === targetId) return null;
  const ranked = rankedGuests(guests);
  const moving = ranked.find((g) => g.id === id);
  const target = ranked.find((g) => g.id === targetId);
  if (!moving || !target) return null;

  const rest = ranked.filter((g) => g.id !== id);
  const at = rest.indexOf(target) + (placement === "after" ? 1 : 0);
  const tier = effectivePriority(target);
  const reordered = [...rest.slice(0, at), { ...moving, priority: tier }, ...rest.slice(at)];

  if (reordered.every((g, i) => g.id === ranked[i].id) && effectivePriority(moving) === tier) {
    return null;
  }

  const updates: Record<string, Partial<Guest>> = {};
  reordered.forEach((g, i) => {
    const u: Partial<Guest> = {};
    if (g.rank !== i) u.rank = i;
    if (g.id === id && moving.priority !== tier) u.priority = tier;
    if (Object.keys(u).length) updates[g.id] = u;
  });
  return updates;
}

/**
 * One step up or down within `visible` (the list as currently shown, i.e.
 * already filtered and ranked). Inside a tier it swaps with the neighbour;
 * at a tier edge it just crosses into the adjacent tier (bottom of the tier
 * above, or top of the tier below) rather than jumping past the neighbour.
 */
export function stepGuest(
  guests: Guest[],
  visible: Guest[],
  id: string,
  direction: -1 | 1,
): Record<string, Partial<Guest>> | null {
  const idx = visible.findIndex((g) => g.id === id);
  const neighbour = visible[idx + direction];
  if (idx === -1 || !neighbour) return null;
  const sameTier = effectivePriority(visible[idx]) === effectivePriority(neighbour);
  const placement: GuestPlacement =
    direction === -1 ? (sameTier ? "before" : "after") : (sameTier ? "after" : "before");
  return moveGuest(guests, id, neighbour.id, placement);
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
