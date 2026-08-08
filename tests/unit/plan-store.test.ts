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

describe("custom budget line items", () => {
  beforeEach(() => {
    usePlanStore.setState({ customBudgetCategories: [], budgetOverrides: {} });
  });

  it("adds a line item with zeroed amount and spend", () => {
    const created = usePlanStore.getState().addCustomBudgetCategory("Rehearsal dinner");
    expect(created.name).toBe("Rehearsal dinner");
    expect(created.amount).toBe(0);
    expect(created.spent).toBe(0);
    expect(usePlanStore.getState().customBudgetCategories).toHaveLength(1);
  });

  it("trims whitespace and ignores an empty name", () => {
    usePlanStore.getState().addCustomBudgetCategory("  Welcome bags  ");
    usePlanStore.getState().addCustomBudgetCategory("   ");
    const cats = usePlanStore.getState().customBudgetCategories;
    expect(cats).toHaveLength(1);
    expect(cats[0].name).toBe("Welcome bags");
  });

  it("reuses an existing line item instead of creating a duplicate row", () => {
    const first = usePlanStore.getState().addCustomBudgetCategory("Favors");
    const second = usePlanStore.getState().addCustomBudgetCategory("favors");
    expect(second.id).toBe(first.id);
    expect(usePlanStore.getState().customBudgetCategories).toHaveLength(1);
  });

  it("updates amount and spent on an existing line item", () => {
    const created = usePlanStore.getState().addCustomBudgetCategory("Rehearsal dinner");
    usePlanStore.getState().updateCustomBudgetCategory(created.id, { amount: 4000, spent: 1500 });
    const cat = usePlanStore.getState().customBudgetCategories[0];
    expect(cat.amount).toBe(4000);
    expect(cat.spent).toBe(1500);
  });

  it("keeps custom amounts when adapter overrides are reset", () => {
    const created = usePlanStore.getState().addCustomBudgetCategory("Rehearsal dinner");
    usePlanStore.getState().updateCustomBudgetCategory(created.id, { amount: 4000, spent: 1500 });
    usePlanStore.getState().setBudgetOverride("venue", { amount: 20000, spent: 0 });

    usePlanStore.getState().resetBudgetOverrides();

    expect(usePlanStore.getState().budgetOverrides).toEqual({});
    expect(usePlanStore.getState().customBudgetCategories[0].amount).toBe(4000);
    expect(usePlanStore.getState().customBudgetCategories[0].spent).toBe(1500);
  });

  it("removes a line item and drops any override keyed to its id", () => {
    const created = usePlanStore.getState().addCustomBudgetCategory("Rehearsal dinner");
    usePlanStore.setState({
      budgetOverrides: { [created.id]: { amount: 999, spent: 1 }, venue: { amount: 20000, spent: 0 } },
    });

    usePlanStore.getState().removeCustomBudgetCategory(created.id);

    expect(usePlanStore.getState().customBudgetCategories).toHaveLength(0);
    expect(usePlanStore.getState().budgetOverrides).toEqual({ venue: { amount: 20000, spent: 0 } });
  });
});

describe("migratePlanStore — v7 → v8 custom budget categories", () => {
  it("seeds an empty customBudgetCategories array", () => {
    const migrated = migratePlanStore({ answers: null }, 7);
    expect(migrated.customBudgetCategories).toEqual([]);
  });

  it("preserves custom categories already present on the payload", () => {
    const existing = [{ id: "custom-1", name: "Rehearsal dinner", amount: 4000, spent: 0 }];
    const migrated = migratePlanStore({ customBudgetCategories: existing }, 7);
    expect(migrated.customBudgetCategories).toEqual(existing);
  });

  it("leaves v8+ payloads untouched", () => {
    const existing = [{ id: "custom-1", name: "Favors", amount: 500, spent: 100 }];
    const migrated = migratePlanStore({ customBudgetCategories: existing }, 8);
    expect(migrated.customBudgetCategories).toEqual(existing);
  });
});

describe("migratePlanStore — v8 → v9 exact wedding date flag", () => {
  const answers = {
    partnerName: "Alex",
    date: "2027-07-15",
    location: "Nashville, TN",
    guestCount: 100,
    budget: 50_000,
    vibe: ["romantic"],
    priorities: ["venue", "food", "photography"],
    setting: "indoor",
    funding: "self",
    stress: ["budget"],
  } as unknown as import("@/lib/types").WeddingAnswers;

  it("marks pre-v9 dates as approximate — they all came from the season picker", () => {
    const migrated = migratePlanStore({ answers }, 8);
    expect(migrated.answers?.dateIsExact).toBe(false);
    expect(migrated.answers?.date).toBe("2027-07-15");
  });

  it("leaves an already-set flag alone", () => {
    const migrated = migratePlanStore({ answers: { ...answers, dateIsExact: true } }, 8);
    expect(migrated.answers?.dateIsExact).toBe(true);
  });

  it("is a no-op when there are no answers yet", () => {
    const migrated = migratePlanStore({ answers: null }, 8);
    expect(migrated.answers).toBeNull();
  });

  it("leaves v9+ payloads untouched", () => {
    const migrated = migratePlanStore({ answers }, 9);
    expect(migrated.answers?.dateIsExact).toBeUndefined();
  });
});

describe("migratePlanStore — v9 → v10 milestones merged into tasks", () => {
  const answers = {
    partnerName: "Alex",
    date: "2027-07-15",
    dateIsExact: true,
    location: "Nashville, TN",
    guestCount: 100,
    budget: 50_000,
    vibe: ["romantic"],
    priorities: ["venue", "food", "photography"],
    setting: "indoor",
    funding: "self",
    stress: ["budget"],
  } as unknown as import("@/lib/types").WeddingAnswers;

  it("materialises completed milestones as done tasks and drops the old slice", () => {
    const migrated = migratePlanStore(
      { answers, tasks: [], timelineDoneIds: ["venue", "catering"] },
      9,
    );
    const done = migrated.tasks.filter((t) => t.done).map((t) => t.id).sort();
    expect(done).toEqual(["catering", "venue"]);
    expect((migrated as { timelineDoneIds?: string[] }).timelineDoneIds).toBeUndefined();
  });

  it("keeps existing tasks alongside the adopted milestones", () => {
    const existing = {
      id: "custom-1", title: "Book hair trial", category: "Custom",
      priority: "medium" as const, done: false,
    };
    const migrated = migratePlanStore(
      { answers, tasks: [existing], timelineDoneIds: ["venue"] },
      9,
    );
    expect(migrated.tasks.map((t) => t.id).sort()).toEqual(["custom-1", "venue"]);
  });

  it("is a no-op when nothing was ticked off", () => {
    const migrated = migratePlanStore({ answers, tasks: [], timelineDoneIds: [] }, 9);
    expect(migrated.tasks).toEqual([]);
  });

  it("leaves v10+ payloads untouched", () => {
    const migrated = migratePlanStore({ answers, tasks: [], timelineDoneIds: ["venue"] }, 10);
    expect(migrated.tasks).toEqual([]);
  });
});

describe("migratePlanStore — v10 → v11 task assignee", () => {
  const task = (over: Partial<import("@/lib/types").Task> = {}) => ({
    id: "custom-1", title: "Book hair trial", category: "Custom",
    priority: "medium" as const, done: false, ...over,
  });

  it("leaves existing tasks unassigned", () => {
    const migrated = migratePlanStore({ tasks: [task()] }, 10);
    expect(migrated.tasks[0].assignee).toBeUndefined();
  });

  it("normalises a blank assignee to undefined", () => {
    const migrated = migratePlanStore({ tasks: [task({ assignee: "   " })] }, 10);
    expect(migrated.tasks[0].assignee).toBeUndefined();
  });

  it("keeps a real assignee", () => {
    const migrated = migratePlanStore({ tasks: [task({ assignee: "Louis" })] }, 10);
    expect(migrated.tasks[0].assignee).toBe("Louis");
  });

  it("handles a payload with no tasks array", () => {
    expect(migratePlanStore({}, 10).tasks).toBeUndefined();
  });
});
