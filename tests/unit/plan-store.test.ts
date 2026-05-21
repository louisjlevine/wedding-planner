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

describe("shared misc line item library", () => {
  beforeEach(() => {
    usePlanStore.setState({ vendors: [], miscLineItemLabels: [] });
  });

  it("adds a label to the shared library", () => {
    const entry = usePlanStore.getState().addMiscLineItemLabel("Cleanup");
    expect(entry.label).toBe("Cleanup");
    expect(usePlanStore.getState().miscLineItemLabels).toHaveLength(1);
  });

  it("dedupes labels case-insensitively", () => {
    usePlanStore.getState().addMiscLineItemLabel("Cleanup");
    usePlanStore.getState().addMiscLineItemLabel("cleanup");
    expect(usePlanStore.getState().miscLineItemLabels).toHaveLength(1);
  });

  it("removes a label from the library AND from every vendor that had a cost for it", () => {
    const entry = usePlanStore.getState().addMiscLineItemLabel("Cleanup");
    usePlanStore.setState({
      vendors: [
        baseVendor({ id: "v1", miscLineItems: [{ id: entry.id, label: "Cleanup", cost: 500 }] }),
        baseVendor({ id: "v2", miscLineItems: [{ id: entry.id, label: "Cleanup", cost: 700 }] }),
        baseVendor({ id: "v3", miscLineItems: [{ id: "other", label: "Other", cost: 100 }] }),
      ],
    });
    usePlanStore.getState().removeMiscLineItemLabel(entry.id);
    expect(usePlanStore.getState().miscLineItemLabels).toHaveLength(0);
    const vendors = usePlanStore.getState().vendors;
    expect(vendors[0].miscLineItems).toBeUndefined();
    expect(vendors[1].miscLineItems).toBeUndefined();
    // Unrelated line items on other vendors are untouched.
    expect(vendors[2].miscLineItems).toHaveLength(1);
  });

  it("renaming a label updates both the registry and any denormalised labels on vendors", () => {
    const entry = usePlanStore.getState().addMiscLineItemLabel("Cleanup");
    usePlanStore.setState({
      vendors: [
        baseVendor({ id: "v1", miscLineItems: [{ id: entry.id, label: "Cleanup", cost: 500 }] }),
      ],
    });
    usePlanStore.getState().renameMiscLineItemLabel(entry.id, "Cleanup fee");
    expect(usePlanStore.getState().miscLineItemLabels[0].label).toBe("Cleanup fee");
    expect(usePlanStore.getState().vendors[0].miscLineItems?.[0].label).toBe("Cleanup fee");
  });
});

describe("migratePlanStore — v5 → v6 shared misc library + bar fields on venue", () => {
  it("builds the shared misc library from existing vendor line items", () => {
    const persisted = {
      vendors: [
        { id: "v1", category: "Venue", name: "Barn", status: "considering", miscLineItems: [
          { id: "m1", label: "Cleanup", cost: 500 },
          { id: "m2", label: "Chairs",  cost: 300 },
        ] },
        { id: "v2", category: "Catering", name: "Forage", status: "considering", miscLineItems: [
          { id: "m3", label: "Cleanup", cost: 600 }, // same label, different id
        ] },
      ],
    };
    const migrated = migratePlanStore(persisted, 5);
    const labels = (migrated.miscLineItemLabels ?? []).map((l) => l.label).sort();
    expect(labels).toEqual(["Chairs", "Cleanup"]);
    // Both vendors should reference the same library id for "Cleanup".
    const v1Cleanup = migrated.vendors.find((v) => v.id === "v1")?.miscLineItems?.find((m) => m.label === "Cleanup");
    const v2Cleanup = migrated.vendors.find((v) => v.id === "v2")?.miscLineItems?.find((m) => m.label === "Cleanup");
    expect(v1Cleanup?.id).toBe(v2Cleanup?.id);
    // Every existing cost is preserved — no data is dropped during migration.
    expect(v1Cleanup?.cost).toBe(500);
    expect(v2Cleanup?.cost).toBe(600);
    const v1Chairs = migrated.vendors.find((v) => v.id === "v1")?.miscLineItems?.find((m) => m.label === "Chairs");
    expect(v1Chairs?.cost).toBe(300);
    // Vendor counts stay the same — nothing got merged or removed.
    expect(migrated.vendors.find((v) => v.id === "v1")?.miscLineItems).toHaveLength(2);
    expect(migrated.vendors.find((v) => v.id === "v2")?.miscLineItems).toHaveLength(1);
  });

  it("moves bar comparison config onto the venue itself", () => {
    const persisted = {
      vendors: [
        { id: "venue-1", category: "Venue", name: "Barn", status: "considering", barMode: "self_host" },
        { id: "venue-2", category: "Venue", name: "Loft", status: "considering", barMode: "via_caterer" },
        { id: "cat-1",   category: "Catering", name: "Forage", status: "considering" },
      ],
      comparison: {
        venueIds: [],
        notes: "",
        venueConfigs: {
          "venue-1": { barFlatBudget: 2500 },
          "venue-2": { catererId: "cat-1", barPerPerson: 25 },
        },
      },
    };
    const migrated = migratePlanStore(persisted, 5);
    const v1 = migrated.vendors.find((v) => v.id === "venue-1");
    const v2 = migrated.vendors.find((v) => v.id === "venue-2");
    const cat = migrated.vendors.find((v) => v.id === "cat-1");
    expect(v1?.barSelfHostAmount).toBe(2500);
    expect(v2?.barVendorId).toBe("cat-1");
    expect(cat?.barCostModel?.perPerson).toBe(25);
  });
});

describe("migratePlanStore — v6 → v7 orphan misc cleanup", () => {
  it("remaps orphan items whose label matches a library entry, and dedupes by label", () => {
    const persisted = {
      miscLineItemLabels: [
        { id: "lib-doc",       label: "DOC" },
        { id: "lib-transport", label: "Transport" },
      ],
      vendors: [
        {
          id: "v1",
          category: "Venue",
          name: "Loft",
          status: "considering",
          miscLineItems: [
            { id: "lib-doc",       label: "DOC",       cost: 2750 },
            { id: "orphan-doc",    label: "DOC",       cost: 2750 }, // orphan id, same label
            { id: "lib-transport", label: "Transport", cost: 2000 },
            { id: "orphan-trans",  label: "transport", cost: 2000 }, // orphan + case diff
          ],
        },
      ],
    };
    const migrated = migratePlanStore(persisted, 6);
    const items = migrated.vendors[0].miscLineItems!;
    // Two distinct labels survive, each once.
    expect(items).toHaveLength(2);
    const ids = items.map((m) => m.id).sort();
    // All orphans got remapped onto the library ids.
    expect(ids).toEqual(["lib-doc", "lib-transport"]);
  });

  it("leaves a clean vendor untouched", () => {
    const persisted = {
      miscLineItemLabels: [{ id: "lib-doc", label: "DOC" }],
      vendors: [
        {
          id: "v1",
          category: "Venue",
          name: "Loft",
          status: "considering",
          miscLineItems: [{ id: "lib-doc", label: "DOC", cost: 2750 }],
        },
      ],
    };
    const migrated = migratePlanStore(persisted, 6);
    expect(migrated.vendors[0].miscLineItems).toHaveLength(1);
    expect(migrated.vendors[0].miscLineItems![0].cost).toBe(2750);
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
