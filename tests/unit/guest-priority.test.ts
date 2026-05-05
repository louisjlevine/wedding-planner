import { describe, it, expect } from "vitest";
import type { Guest } from "@/lib/types";
import {
  priorityFromRelationship,
  effectivePriority,
  compareGuestRank,
  rankedGuests,
  applyCutoff,
} from "@/lib/guest-priority";

const guest = (over: Partial<Guest> = {}): Guest => ({
  id:          over.id ?? "g",
  name:        over.name ?? "Guest",
  totalGuests: over.totalGuests ?? 1,
  rsvp:        over.rsvp ?? "pending",
  ...over,
});

describe("priorityFromRelationship", () => {
  it("maps family and close_friend to 'must'", () => {
    expect(priorityFromRelationship("family")).toBe("must");
    expect(priorityFromRelationship("close_friend")).toBe("must");
  });

  it("maps acquaintance to 'ifSpace'", () => {
    expect(priorityFromRelationship("acquaintance")).toBe("ifSpace");
  });

  it("defaults friend and undefined to 'want'", () => {
    expect(priorityFromRelationship("friend")).toBe("want");
    expect(priorityFromRelationship(undefined)).toBe("want");
  });
});

describe("effectivePriority", () => {
  it("uses explicit priority when set", () => {
    expect(effectivePriority(guest({ priority: "ifSpace", relationship: "family" })))
      .toBe("ifSpace");
  });

  it("falls back to relationship-derived priority when missing", () => {
    expect(effectivePriority(guest({ relationship: "family" }))).toBe("must");
    expect(effectivePriority(guest({ relationship: "acquaintance" }))).toBe("ifSpace");
    expect(effectivePriority(guest({}))).toBe("want");
  });
});

describe("compareGuestRank / rankedGuests", () => {
  it("orders must → want → ifSpace", () => {
    const a = guest({ id: "a", name: "Aaa", priority: "ifSpace" });
    const b = guest({ id: "b", name: "Bbb", priority: "must" });
    const c = guest({ id: "c", name: "Ccc", priority: "want" });
    expect(rankedGuests([a, b, c]).map((g) => g.id)).toEqual(["b", "c", "a"]);
  });

  it("within a tier, family beats friend beats acquaintance", () => {
    const fam    = guest({ id: "fam", name: "Z", priority: "must", relationship: "family" });
    const close  = guest({ id: "cf",  name: "Y", priority: "must", relationship: "close_friend" });
    expect(rankedGuests([close, fam]).map((g) => g.id)).toEqual(["fam", "cf"]);
  });

  it("falls back to alphabetical name as final tiebreaker", () => {
    const a = guest({ id: "a", name: "Anna",  priority: "want", relationship: "friend" });
    const b = guest({ id: "b", name: "Boris", priority: "want", relationship: "friend" });
    expect(rankedGuests([b, a]).map((g) => g.id)).toEqual(["a", "b"]);
  });
});

describe("applyCutoff", () => {
  const louis  = guest({ id: "1", name: "Louis", priority: "must",    totalGuests: 2, relationship: "family",       guestLocation: "local",       rsvp: "yes" });
  const becca  = guest({ id: "2", name: "Becca", priority: "must",    totalGuests: 1, relationship: "close_friend", guestLocation: "local",       rsvp: "pending" });
  const jay    = guest({ id: "3", name: "Jay",   priority: "want",    totalGuests: 1, relationship: "friend",       guestLocation: "local",       rsvp: "pending" });
  const sam    = guest({ id: "4", name: "Sam",   priority: "ifSpace", totalGuests: 1, relationship: "acquaintance", guestLocation: "out_of_town", rsvp: "pending" });

  const all = [louis, becca, jay, sam];

  it("returns empty cut set and full totals when target is null", () => {
    const r = applyCutoff(all, null);
    expect(r.cutIds.size).toBe(0);
    expect(r.invitedSeats).toBe(5);
    expect(r.estimatedAttending).toBeGreaterThan(0);
  });

  it("cuts everyone past the invited-seats target", () => {
    // ranked order: Louis (2), Becca (1), Jay (1), Sam (1) → seats 2,3,4,5
    const r = applyCutoff(all, 3, "invited");
    // Louis (2) + Becca (1) = 3 fits; Jay would push to 4 → cut.
    expect(r.invitedSeats).toBe(3);
    expect([...r.cutIds].sort()).toEqual(["3", "4"]);
  });

  it("cuts everyone past the est-attending target", () => {
    // expected: Louis 2.0 (yes), Becca 1.0 (close_friend local pending), Jay 0.75, Sam 0.25
    // target 3 → keep Louis+Becca (3.0), Jay would push to 3.75 → cut.
    const r = applyCutoff(all, 3, "attending");
    expect([...r.cutIds].sort()).toEqual(["3", "4"]);
    expect(r.estimatedAttending).toBe(3);
  });

  it("respects priority tiers — a low-tier guest is cut even if they alphabetize earlier", () => {
    const aaron = guest({ id: "aaron", name: "Aaron", priority: "ifSpace", totalGuests: 1, relationship: "acquaintance", guestLocation: "local", rsvp: "pending" });
    const zoe   = guest({ id: "zoe",   name: "Zoe",   priority: "must",    totalGuests: 1, relationship: "family",       guestLocation: "local", rsvp: "pending" });
    const r = applyCutoff([aaron, zoe], 1, "invited");
    expect(r.cutIds.has("aaron")).toBe(true);
    expect(r.cutIds.has("zoe")).toBe(false);
  });

  it("once a guest is cut, all lower-ranked guests are also cut even if they would fit", () => {
    // Louis (2 seats) takes us to 2; target 3 means Becca (1) fits → seats=3.
    // Jay (1) would exceed → cut. Sam (1) on its own would still fit at 3 but
    // must remain cut to preserve rank order.
    const r = applyCutoff(all, 3, "invited");
    expect(r.cutIds.has("3")).toBe(true);
    expect(r.cutIds.has("4")).toBe(true);
  });
});
