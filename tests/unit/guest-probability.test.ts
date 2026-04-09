import { describe, it, expect } from "vitest";
import {
  getBaseProbability,
  guestExpectedCount,
  estimatedAttendance,
} from "@/lib/guest-probability";
import type { Guest } from "@/lib/types";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeGuest(overrides: Partial<Guest> = {}): Guest {
  return {
    id: "g1",
    name: "Test Person",
    totalGuests: 1,
    rsvp: "pending",
    ...overrides,
  };
}

// ── getBaseProbability ────────────────────────────────────────────────────────

describe("getBaseProbability", () => {
  it("returns 1.00 for local family", () => {
    expect(getBaseProbability(makeGuest({ relationship: "family", guestLocation: "local" }))).toBe(1.00);
  });

  it("returns 0.85 for out-of-town family", () => {
    expect(getBaseProbability(makeGuest({ relationship: "family", guestLocation: "out_of_town" }))).toBe(0.85);
  });

  it("returns 1.00 for local close friend", () => {
    expect(getBaseProbability(makeGuest({ relationship: "close_friend", guestLocation: "local" }))).toBe(1.00);
  });

  it("returns 0.75 for out-of-town close friend", () => {
    expect(getBaseProbability(makeGuest({ relationship: "close_friend", guestLocation: "out_of_town" }))).toBe(0.75);
  });

  it("returns 0.75 for local friend", () => {
    expect(getBaseProbability(makeGuest({ relationship: "friend", guestLocation: "local" }))).toBe(0.75);
  });

  it("returns 0.45 for out-of-town friend", () => {
    expect(getBaseProbability(makeGuest({ relationship: "friend", guestLocation: "out_of_town" }))).toBe(0.45);
  });

  it("returns 0.50 for local acquaintance", () => {
    expect(getBaseProbability(makeGuest({ relationship: "acquaintance", guestLocation: "local" }))).toBe(0.50);
  });

  it("returns 0.25 for out-of-town acquaintance", () => {
    expect(getBaseProbability(makeGuest({ relationship: "acquaintance", guestLocation: "out_of_town" }))).toBe(0.25);
  });

  it("returns default 0.70 when relationship/location not set", () => {
    expect(getBaseProbability(makeGuest())).toBe(0.70);
  });
});

// ── guestExpectedCount ────────────────────────────────────────────────────────

describe("guestExpectedCount", () => {
  it("returns 1.0 for a confirmed 'yes' guest without plus-one", () => {
    const g = makeGuest({ rsvp: "yes", relationship: "family", guestLocation: "local" });
    expect(guestExpectedCount(g)).toBe(1.0);
  });

  it("returns 0 for a 'no' RSVP", () => {
    const g = makeGuest({ rsvp: "no", relationship: "family", guestLocation: "local" });
    expect(guestExpectedCount(g)).toBe(0);
  });

  it("'maybe' reduces expected count to p * 0.5", () => {
    const g = makeGuest({ rsvp: "maybe", relationship: "family", guestLocation: "local" });
    // p = 1.00, factor = 1.00 * 0.5 = 0.5
    expect(guestExpectedCount(g)).toBeCloseTo(0.5);
  });

  it("'pending' uses base probability as factor", () => {
    const g = makeGuest({ rsvp: "pending", relationship: "friend", guestLocation: "local" });
    // p = 0.75, factor = 0.75
    expect(guestExpectedCount(g)).toBeCloseTo(0.75);
  });

  it("returns 2.0 for a confirmed yes with totalGuests = 2", () => {
    const g = makeGuest({ rsvp: "yes", totalGuests: 2 });
    expect(guestExpectedCount(g)).toBeCloseTo(2.0);
  });

  it("totalGuests scales expected count for pending guest", () => {
    const g = makeGuest({ rsvp: "pending", relationship: "friend", guestLocation: "local", totalGuests: 2 });
    // factor = 0.75, totalGuests = 2 → total = 1.5
    expect(guestExpectedCount(g)).toBeCloseTo(1.5);
  });

  it("'no' RSVP with totalGuests > 1 still returns 0", () => {
    const g = makeGuest({ rsvp: "no", totalGuests: 2 });
    expect(guestExpectedCount(g)).toBe(0);
  });

  it("totalGuests = 3 scales expected count proportionally", () => {
    const g = makeGuest({ rsvp: "yes", totalGuests: 3 });
    expect(guestExpectedCount(g)).toBeCloseTo(3.0);
  });
});

// ── estimatedAttendance ───────────────────────────────────────────────────────

describe("estimatedAttendance", () => {
  it("returns 0 for an empty guest list", () => {
    expect(estimatedAttendance([])).toBe(0);
  });

  it("returns exact count when all guests confirmed yes, no plus-ones", () => {
    const guests = [
      makeGuest({ id: "g1", rsvp: "yes" }),
      makeGuest({ id: "g2", rsvp: "yes" }),
      makeGuest({ id: "g3", rsvp: "yes" }),
    ];
    expect(estimatedAttendance(guests)).toBe(3);
  });

  it("excludes 'no' RSVPs from count", () => {
    const guests = [
      makeGuest({ id: "g1", rsvp: "yes" }),
      makeGuest({ id: "g2", rsvp: "no" }),
    ];
    expect(estimatedAttendance(guests)).toBe(1);
  });

  it("returns a rounded integer", () => {
    const guests = [
      makeGuest({ id: "g1", rsvp: "maybe", relationship: "friend", guestLocation: "local" }),
    ];
    const result = estimatedAttendance(guests);
    expect(Number.isInteger(result)).toBe(true);
  });

  it("sums expected counts for all guests including totalGuests", () => {
    const guests = [
      makeGuest({ id: "g1", rsvp: "yes" }),
      makeGuest({ id: "g2", rsvp: "yes", totalGuests: 2 }),
    ];
    // 1.0 + 2.0 = 3.0 → rounds to 3
    expect(estimatedAttendance(guests)).toBe(3);
  });
});
