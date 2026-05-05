import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Guest, Vendor, VendorNote, MiscLineItem, VendorCostModel } from "@/lib/types";

// Zustand's persist middleware needs a localStorage shim in the node test env.
const memStorage = (() => {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  };
})();
vi.stubGlobal("localStorage", memStorage);

const { usePlanStore, migratePlanStore } = await import("@/lib/plan-store");

const baseVendor = (overrides: Partial<Vendor> = {}): Vendor => ({
  id: "vendor-1",
  category: "Venue",
  name: "The Barn",
  status: "considering",
  ...overrides,
});

describe("mergeVendors", () => {
  beforeEach(() => {
    usePlanStore.setState({ vendors: [], deletedVendorIds: [] });
  });

  it("adds new vendors that don't exist locally", () => {
    const incoming: Vendor[] = [baseVendor({ id: "vendor-new", name: "Newly imported" })];
    usePlanStore.getState().mergeVendors(incoming);
    expect(usePlanStore.getState().vendors).toHaveLength(1);
    expect(usePlanStore.getState().vendors[0].name).toBe("Newly imported");
  });

  it("skips vendors that were locally deleted", () => {
    usePlanStore.setState({ deletedVendorIds: ["vendor-deleted"] });
    usePlanStore.getState().mergeVendors([baseVendor({ id: "vendor-deleted" })]);
    expect(usePlanStore.getState().vendors).toHaveLength(0);
  });

  it("preserves locally-added miscLineItems when server snapshot lacks them", () => {
    const misc: MiscLineItem[] = [{ id: "m1", label: "Cleanup", cost: 500 }];
    usePlanStore.setState({
      vendors: [baseVendor({ id: "v1", miscLineItems: misc })],
    });
    // Server snapshot is older — no miscLineItems on the same vendor.
    usePlanStore.getState().mergeVendors([baseVendor({ id: "v1" })]);
    expect(usePlanStore.getState().vendors[0].miscLineItems).toEqual(misc);
  });

  it("preserves locally-added costModel when server snapshot lacks it", () => {
    const costModel: VendorCostModel = { base: 12000, hoursIncluded: 8, overtimeHourly: 750 };
    usePlanStore.setState({
      vendors: [baseVendor({ id: "v1", costModel })],
    });
    usePlanStore.getState().mergeVendors([baseVendor({ id: "v1" })]);
    expect(usePlanStore.getState().vendors[0].costModel).toEqual(costModel);
  });

  it("preserves packages, barMode, attachments, and tags when server snapshot lacks them", () => {
    usePlanStore.setState({
      vendors: [
        baseVendor({
          id: "v1",
          packages: [{ id: "p1", name: "Plated", perPerson: 145 }],
          barMode: "self_host",
          attachments: [{ id: "a1", fileName: "quote.pdf", mimeType: "application/pdf", dataUrl: "data:...", addedAt: "2026-01-01" }],
          tags: ["Toured", "Has Quote"],
        }),
      ],
    });
    usePlanStore.getState().mergeVendors([baseVendor({ id: "v1" })]);
    const v = usePlanStore.getState().vendors[0];
    expect(v.packages).toHaveLength(1);
    expect(v.barMode).toBe("self_host");
    expect(v.attachments).toHaveLength(1);
    expect(v.tags).toEqual(["Toured", "Has Quote"]);
  });

  it("fills in fields missing locally with server values", () => {
    usePlanStore.setState({
      vendors: [baseVendor({ id: "v1", website: undefined, contact: undefined })],
    });
    usePlanStore.getState().mergeVendors([
      baseVendor({ id: "v1", website: "https://example.com", contact: "hello@example.com" }),
    ]);
    const v = usePlanStore.getState().vendors[0];
    expect(v.website).toBe("https://example.com");
    expect(v.contact).toBe("hello@example.com");
  });

  it("unions notesList: keeps local notes and appends new server notes", () => {
    const localNote: VendorNote = { id: "note-local", text: "Toured Saturday", addedAt: "2026-04-01" };
    const serverNote: VendorNote = { id: "note-from-shortcut", text: "Imported via iOS", addedAt: "2026-04-15" };
    usePlanStore.setState({
      vendors: [baseVendor({ id: "v1", notesList: [localNote] })],
    });
    usePlanStore.getState().mergeVendors([
      baseVendor({ id: "v1", notesList: [localNote, serverNote] }),
    ]);
    const notes = usePlanStore.getState().vendors[0].notesList ?? [];
    expect(notes.map((n) => n.id)).toEqual(["note-local", "note-from-shortcut"]);
  });

  it("does not duplicate notes that already exist locally", () => {
    const note: VendorNote = { id: "note-1", text: "Same note", addedAt: "2026-04-01" };
    usePlanStore.setState({
      vendors: [baseVendor({ id: "v1", notesList: [note] })],
    });
    usePlanStore.getState().mergeVendors([baseVendor({ id: "v1", notesList: [note] })]);
    const notes = usePlanStore.getState().vendors[0].notesList ?? [];
    expect(notes).toHaveLength(1);
  });

  it("preserves local status edits even when server has a different status", () => {
    usePlanStore.setState({
      vendors: [baseVendor({ id: "v1", status: "booked" })],
    });
    usePlanStore.getState().mergeVendors([baseVendor({ id: "v1", status: "considering" })]);
    expect(usePlanStore.getState().vendors[0].status).toBe("booked");
  });
});

describe("migratePlanStore — v4 → v5 guest priority backfill", () => {
  const guest = (over: Partial<Guest> = {}): Guest => ({
    id:          over.id ?? "g",
    name:        over.name ?? "Guest",
    totalGuests: over.totalGuests ?? 1,
    rsvp:        over.rsvp ?? "pending",
    ...over,
  });

  it("pre-seeds priority on existing guests based on relationship", () => {
    const persisted = {
      guests: [
        guest({ id: "fam", relationship: "family" }),
        guest({ id: "cf",  relationship: "close_friend" }),
        guest({ id: "fr",  relationship: "friend" }),
        guest({ id: "ac",  relationship: "acquaintance" }),
        guest({ id: "no" }), // no relationship set
      ],
    };
    const migrated = migratePlanStore(persisted, 4);
    const byId = Object.fromEntries(migrated.guests.map((g) => [g.id, g.priority]));
    expect(byId).toEqual({
      fam: "must",
      cf:  "must",
      fr:  "want",
      ac:  "ifSpace",
      no:  "want",
    });
  });

  it("does not overwrite an explicit priority that was already set", () => {
    const persisted = {
      guests: [guest({ id: "x", relationship: "family", priority: "ifSpace" })],
    };
    const migrated = migratePlanStore(persisted, 4);
    expect(migrated.guests[0].priority).toBe("ifSpace");
  });

  it("is a no-op for v5+ payloads (priority already present)", () => {
    const persisted = {
      guests: [guest({ id: "x", priority: "want" })],
    };
    const migrated = migratePlanStore(persisted, 5);
    expect(migrated.guests[0].priority).toBe("want");
  });

  it("handles a payload with no guests array", () => {
    const migrated = migratePlanStore({}, 4);
    expect(migrated.guests).toBeUndefined();
  });
});
