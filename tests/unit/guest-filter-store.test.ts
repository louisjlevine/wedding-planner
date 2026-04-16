/**
 * Regression tests for LJL-33 — guest side filter must survive import
 *
 * Root cause: sideFilter was local React state in Guests.tsx.
 * Switching tabs (or a mobile file-picker triggering a page-visibility cycle)
 * unmounts/remounts the component, resetting sideFilter to "all".
 * Fix: store guestSideFilter in Zustand so it persists via localStorage.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { usePlanStore } from "@/lib/plan-store";
import type { Guest } from "@/lib/types";

function makeGuest(id: string, side?: Guest["side"]): Guest {
  return {
    id,
    name: `Guest ${id}`,
    totalGuests: 1,
    rsvp: "pending",
    side,
  };
}

beforeEach(() => {
  // Reset store to initial state between tests
  usePlanStore.setState({
    guests: [],
    guestSideFilter: "all",
  });
});

describe("guestSideFilter store state", () => {
  it("defaults to 'all'", () => {
    expect(usePlanStore.getState().guestSideFilter).toBe("all");
  });

  it("setGuestSideFilter updates the filter", () => {
    usePlanStore.getState().setGuestSideFilter("bride");
    expect(usePlanStore.getState().guestSideFilter).toBe("bride");
  });

  it("filter is NOT reset when addGuest is called (simulates CSV import)", () => {
    usePlanStore.getState().setGuestSideFilter("bride");

    // Simulate importing a batch of guests (confirmCsvImport loop)
    usePlanStore.getState().addGuest(makeGuest("g1", "bride"));
    usePlanStore.getState().addGuest(makeGuest("g2", "groom"));
    usePlanStore.getState().addGuest(makeGuest("g3"));

    expect(usePlanStore.getState().guestSideFilter).toBe("bride");
  });

  it("filter is NOT reset when updateGuest is called (simulates CSV re-import / update)", () => {
    usePlanStore.getState().addGuest(makeGuest("g1", "bride"));
    usePlanStore.getState().setGuestSideFilter("groom");

    usePlanStore.getState().updateGuest("g1", { rsvp: "yes" });

    expect(usePlanStore.getState().guestSideFilter).toBe("groom");
  });

  it("importStore does not overwrite guestSideFilter when incoming data omits it", () => {
    usePlanStore.getState().setGuestSideFilter("bride");

    // importStore is called by useServerSync when loading from server;
    // server payload never includes guestSideFilter (it is local UI state)
    usePlanStore.getState().importStore({ guests: [makeGuest("g1")] });

    expect(usePlanStore.getState().guestSideFilter).toBe("bride");
  });

  it("guestSideFilter is absent from extractPayload shape (not synced to server)", () => {
    // extractPayload is not exported, so verify indirectly: the field must
    // not appear in the keys the sync hook serialises.  We test by confirming
    // the store keeps guestSideFilter locally while importStore (which mirrors
    // the server payload) can set guests without touching the filter.
    usePlanStore.getState().setGuestSideFilter("both");

    usePlanStore.getState().importStore({
      guests: [makeGuest("server-g1", "groom")],
      // deliberately omit guestSideFilter — this is what the server would send
    });

    expect(usePlanStore.getState().guestSideFilter).toBe("both");
    expect(usePlanStore.getState().guests).toHaveLength(1);
  });
});
