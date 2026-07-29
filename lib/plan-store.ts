"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  WeddingAnswers,
  Vendor,
  Task,
  Guest,
  Note,
  ResearchSession,
  ResearchRecommendation,
  ResearchChatMessage,
  AdvisorMessage,
  Tab,
  EmailDigestPrefs,
  ComparisonSelection,
  VenueComparisonConfig,
  BarMode,
  MiscLineItem,
  MiscLineItemLabel,
  CustomBudgetCategory,
} from "./types";
import { priorityFromRelationship } from "./guest-priority";

const EMPTY_COMPARISON: ComparisonSelection = {
  venueIds: [],
  venueConfigs: {},
  notes: "",
};

interface BudgetOverride {
  amount: number;  // user-set dollar allocation
  spent: number;   // user-tracked spend
}

interface PlanState {
  answers: WeddingAnswers | null;
  vendors: Vendor[];
  tasks: Task[];
  guests: Guest[];
  notes: Note[];
  researchSessions: Record<string, ResearchSession>;
  advisorMessages: AdvisorMessage[];
  budgetOverrides: Record<string, BudgetOverride>;
  customBudgetCategories: CustomBudgetCategory[];
  dismissedRecommendations: Record<string, string[]>; // type → [lowercased title, ...]
  triggerResearchFor: string | null; // set by Vendors "Find similar" to auto-fetch
  timelineDoneIds: string[];
  activeTab: Tab;
  intakeComplete: boolean;
  vendorFilterHideRejected: boolean;
  deletedVendorIds: string[]; // track locally-deleted vendors to prevent re-import
  deletedVendorDomains: string[]; // track domains of deleted vendors to prevent re-import
  // Shared registry of misc line item labels — adding a label to one vendor
  // makes it available to all vendors; removing it removes from all.
  miscLineItemLabels: MiscLineItemLabel[];

  setAnswers: (answers: WeddingAnswers) => void;
  updateAnswers: (partial: Partial<WeddingAnswers>) => void;
  resetIntake: () => void;

  addVendor: (vendor: Vendor) => void;
  updateVendor: (id: string, updates: Partial<Vendor>) => void;
  removeVendor: (id: string) => void;
  mergeVendors: (incoming: Vendor[]) => void;

  // Shared misc line item label library
  addMiscLineItemLabel: (label: string) => MiscLineItemLabel;
  renameMiscLineItemLabel: (id: string, label: string) => void;
  removeMiscLineItemLabel: (id: string) => void; // also strips from every vendor
  setVendorMiscLineItem: (vendorId: string, item: MiscLineItem) => void;

  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  toggleTask: (id: string) => void;
  removeTask: (id: string) => void;

  addGuest: (guest: Guest) => void;
  updateGuest: (id: string, updates: Partial<Guest>) => void;
  removeGuest: (id: string) => void;

  addNote: (content: string) => void;
  removeNote: (id: string) => void;

  // Research sessions
  setResearchNotes: (type: string, notes: string) => void;
  setResearchRecommendations: (type: string, recs: ResearchRecommendation[], fetchedAt: string) => void;
  updateRecommendation: (type: string, id: string, updates: Partial<ResearchRecommendation>) => void;
  removeRecommendation: (type: string, id: string) => void;
  dismissRecommendation: (type: string, id: string, title: string) => void;
  markRecommendationDismissed: (type: string, title: string) => void;
  addResearchChatMessage: (type: string, msg: ResearchChatMessage) => void;
  updateLastResearchChat: (type: string, content: string) => void;
  clearResearchSession: (type: string) => void;

  // Advisor memory
  setAdvisorMessages: (messages: AdvisorMessage[]) => void;
  appendAdvisorMessage: (msg: AdvisorMessage) => void;
  updateLastAdvisorMessage: (content: string) => void;

  // Budget overrides
  setBudgetOverride: (id: string, override: BudgetOverride) => void;
  resetBudgetOverrides: () => void;

  // User-added budget line items
  addCustomBudgetCategory: (name: string) => CustomBudgetCategory;
  updateCustomBudgetCategory: (id: string, updates: Partial<Omit<CustomBudgetCategory, "id">>) => void;
  removeCustomBudgetCategory: (id: string) => void;

  // Research trigger from Vendors
  setTriggerResearchFor: (type: string | null) => void;

  // Timeline done state
  toggleTimelineItem: (id: string) => void;

  emailPrefs: EmailDigestPrefs | null;
  setEmailPrefs: (prefs: EmailDigestPrefs) => void;

  setActiveTab: (tab: Tab) => void;
  setVendorFilterHideRejected: (hide: boolean) => void;
  importStore: (data: Partial<PlanState>) => void;

  // Compare dashboard
  comparison: ComparisonSelection;
  updateComparison: (partial: Partial<ComparisonSelection>) => void;
  updateVenueConfig: (venueId: string, partial: Partial<VenueComparisonConfig>) => void;

  // Cross-tab vendor editing — Compare uses this to deep-link into Vendors
  editingVendorId: string | null;
  setEditingVendorId: (id: string | null) => void;
}

function emptySession(state: PlanState, type: string): ResearchSession {
  return state.researchSessions[type] ?? { notes: "", recommendations: [], chatMessages: [] };
}

export function migratePlanStore(persisted: unknown, version: number): PlanState {
  const state = (persisted as Partial<PlanState>) ?? {};
  if (version < 1) {
    state.vendorFilterHideRejected = true;
  }
  if (version < 2) {
    state.comparison = EMPTY_COMPARISON;
  }
  if (version < 3) {
    if (Array.isArray(state.vendors)) {
      state.vendors = state.vendors.map((v) => {
        const old = v as Vendor & { barAllowedModes?: BarMode[] };
        if (old.barAllowedModes && old.barAllowedModes.length > 0 && !old.barMode) {
          const { barAllowedModes, ...rest } = old;
          void barAllowedModes;
          return { ...rest, barMode: old.barAllowedModes[0] };
        }
        if (old.barAllowedModes) {
          const { barAllowedModes, ...rest } = old;
          void barAllowedModes;
          return rest;
        }
        return v;
      });
    }
    if (state.comparison?.venueConfigs) {
      const cleaned: Record<string, VenueComparisonConfig> = {};
      for (const [venueId, cfg] of Object.entries(state.comparison.venueConfigs)) {
        const { barMode: _drop, ...rest } = cfg as VenueComparisonConfig & { barMode?: BarMode };
        void _drop;
        cleaned[venueId] = rest;
      }
      state.comparison = { ...state.comparison, venueConfigs: cleaned };
    }
  }
  if (version < 4) {
    const total = state.answers?.budget ?? 0;
    const old = state.budgetOverrides as
      | Record<string, { percentage?: number; amount?: number; spent: number }>
      | undefined;
    if (old && total > 0) {
      const migrated: Record<string, BudgetOverride> = {};
      for (const [id, ov] of Object.entries(old)) {
        const amount =
          typeof ov.amount === "number"
            ? ov.amount
            : Math.round(((ov.percentage ?? 0) / 100) * total);
        migrated[id] = { amount, spent: ov.spent ?? 0 };
      }
      state.budgetOverrides = migrated;
    } else {
      state.budgetOverrides = {};
    }
  }
  if (version < 5) {
    // Pre-seed `priority` on existing guests so the new ranking/cutoff UI has
    // a sensible default for each guest. Family/close friends start as
    // "must", acquaintances as "ifSpace", everyone else "want".
    if (Array.isArray(state.guests)) {
      state.guests = state.guests.map((g) =>
        g.priority ? g : { ...g, priority: priorityFromRelationship(g.relationship) }
      );
    }
  }
  if (version < 6) {
    // Build the shared misc-label library from any labels already in use, and
    // normalise each vendor's miscLineItems to reference library ids. Vendors
    // with the same label keep a consistent id afterwards.
    if (Array.isArray(state.vendors)) {
      const labelMap = new Map<string, MiscLineItemLabel>();
      state.vendors = state.vendors.map((v) => {
        const items = v.miscLineItems ?? [];
        if (items.length === 0) return v;
        const remapped = items.map((m) => {
          const key = (m.label ?? "").trim();
          if (!key) return m;
          const existing = labelMap.get(key.toLowerCase());
          if (existing) {
            return { ...m, id: existing.id, label: existing.label };
          }
          const entry: MiscLineItemLabel = { id: m.id || `lbl-${labelMap.size}-${Date.now()}`, label: key };
          labelMap.set(key.toLowerCase(), entry);
          return { ...m, id: entry.id, label: entry.label };
        });
        return { ...v, miscLineItems: remapped };
      });
      state.miscLineItemLabels = Array.from(labelMap.values());
    } else {
      state.miscLineItemLabels = [];
    }

    // Migrate bar config off VenueComparisonConfig onto the venue itself.
    const cmp = state.comparison;
    if (cmp && cmp.venueConfigs && Array.isArray(state.vendors)) {
      const venuesById = new Map(state.vendors.map((v) => [v.id, v]));
      for (const [venueId, cfg] of Object.entries(cmp.venueConfigs)) {
        const venue = venuesById.get(venueId);
        if (!venue) continue;
        if (venue.barMode === "self_host" && typeof cfg.barFlatBudget === "number" && venue.barSelfHostAmount === undefined) {
          venue.barSelfHostAmount = cfg.barFlatBudget;
        }
        if (venue.barMode === "via_caterer" && typeof cfg.barPerPerson === "number") {
          // Point at the caterer chosen for this venue if available; copy the
          // per-person rate onto that caterer's bar pricing so the legacy
          // amount carries over.
          if (cfg.catererId) {
            venue.barVendorId = venue.barVendorId ?? cfg.catererId;
            const caterer = venuesById.get(cfg.catererId);
            if (caterer && !caterer.barCostModel) {
              caterer.barCostModel = { perPerson: cfg.barPerPerson };
            }
          }
        }
      }
    }
  }
  if (version < 7) {
    // The v6 migration set up the shared library, but server-merged vendors
    // (or stale local data) could still carry "orphan" miscLineItems whose
    // id doesn't match any library entry while their label does. Those orphans
    // were invisible in the editor but still summed in compute, causing
    // double counts on Compare. Re-map any orphan whose label matches a
    // library entry onto the library id, then dedupe each vendor's items.
    if (Array.isArray(state.vendors) && Array.isArray(state.miscLineItemLabels)) {
      const labelToId = new Map<string, string>();
      for (const l of state.miscLineItemLabels) {
        labelToId.set(l.label.trim().toLowerCase(), l.id);
      }
      state.vendors = state.vendors.map((v) => {
        const items = v.miscLineItems ?? [];
        if (items.length === 0) return v;
        const seenIds = new Set<string>();
        const seenLabels = new Set<string>();
        const cleaned = [] as typeof items;
        for (const m of items) {
          const labelKey = (m.label ?? "").trim().toLowerCase();
          const mappedId = labelKey ? labelToId.get(labelKey) : undefined;
          const id = mappedId ?? m.id;
          if (seenIds.has(id)) continue;
          if (labelKey && seenLabels.has(labelKey)) continue;
          seenIds.add(id);
          if (labelKey) seenLabels.add(labelKey);
          cleaned.push({ ...m, id });
        }
        return { ...v, miscLineItems: cleaned };
      });
    }
  }
  if (version < 8) {
    // New persisted field: user-added budget line items. Existing plans start
    // with none — the adapter-derived categories are unchanged.
    if (!Array.isArray(state.customBudgetCategories)) {
      state.customBudgetCategories = [];
    }
  }
  if (version < 9) {
    // New persisted field: WeddingAnswers.dateIsExact. Every date recorded
    // before this version came from the season + year picker, so it's a
    // placeholder — mark it approximate rather than claiming a specific day.
    if (state.answers && state.answers.dateIsExact === undefined) {
      state.answers = { ...state.answers, dateIsExact: false };
    }
  }
  return state as PlanState;
}

export const usePlanStore = create<PlanState>()(
  persist(
    (set) => ({
      answers: null,
      vendors: [],
      tasks: [],
      guests: [],
      notes: [],
      researchSessions: {},
      advisorMessages: [],
      budgetOverrides: {},
      customBudgetCategories: [],
      dismissedRecommendations: {},
      triggerResearchFor: null,
      timelineDoneIds: [],
      activeTab: "overview",
      intakeComplete: false,
      emailPrefs: null,
      vendorFilterHideRejected: true,
      deletedVendorIds: [],
      deletedVendorDomains: [],
      comparison: EMPTY_COMPARISON,
      editingVendorId: null,
      miscLineItemLabels: [],

      setAnswers: (answers) =>
        set({ answers, intakeComplete: true, activeTab: "advisor" }),

      updateAnswers: (partial) =>
        set((state) => ({
          answers: state.answers ? { ...state.answers, ...partial } : null,
        })),

      resetIntake: () =>
        set({ answers: null, intakeComplete: false, activeTab: "overview" }),

      addVendor: (vendor) =>
        set((state) => ({ 
          vendors: [...state.vendors, vendor],
          // Remove from deleted list if it was previously deleted and is being re-added
          deletedVendorIds: state.deletedVendorIds.filter((id) => id !== vendor.id),
        })),

      // Merge incoming vendors from server. Local is the source of truth for
      // any field defined locally — the server can only ADD new vendors and
      // FILL IN fields that aren't set locally yet. Replacing existing vendors
      // wholesale (the previous behaviour) wiped local edits like
      // miscLineItems / costModel / packages / attachments whenever a poll
      // raced ahead of the 1.5s useServerSync debounce.
      mergeVendors: (incoming) =>
        set((state) => {
          const localById = new Map(state.vendors.map((v) => [v.id, v]));
          incoming.forEach((v) => {
            if (state.deletedVendorIds.includes(v.id)) return;
            const existing = localById.get(v.id);
            if (!existing) {
              localById.set(v.id, v);
              return;
            }
            // Start with server values, then overlay locally-defined fields
            // so local edits always win. Undefined locals fall through to the
            // server value (lets the iOS-shortcut importer backfill missing
            // contact / website / etc.).
            const localDefined = Object.fromEntries(
              Object.entries(existing).filter(([, val]) => val !== undefined)
            );
            const merged: Vendor = { ...v, ...localDefined } as Vendor;
            // Notes are append-only across sources (iOS shortcut / email
            // importer add notes to the same vendor by id), so union them.
            const localNotes = existing.notesList ?? [];
            const localNoteIds = new Set(localNotes.map((n) => n.id));
            const newServerNotes = (v.notesList ?? []).filter((n) => !localNoteIds.has(n.id));
            if (newServerNotes.length > 0) {
              merged.notesList = [...localNotes, ...newServerNotes];
            }
            localById.set(v.id, merged);
          });
          return { vendors: Array.from(localById.values()) };
        }),

      updateVendor: (id, updates) =>
        set((state) => ({
          vendors: state.vendors.map((v) =>
            v.id === id ? { ...v, ...updates } : v
          ),
        })),

      addMiscLineItemLabel: (label) => {
        const trimmed = label.trim();
        if (!trimmed) {
          return { id: "", label: "" };
        }
        // Reuse an existing entry if one matches (case-insensitive); otherwise
        // create a new one.
        let entry: MiscLineItemLabel | undefined;
        set((state) => {
          const found = state.miscLineItemLabels.find(
            (l) => l.label.toLowerCase() === trimmed.toLowerCase(),
          );
          if (found) {
            entry = found;
            return state;
          }
          entry = { id: `lbl-${Date.now()}-${state.miscLineItemLabels.length}`, label: trimmed };
          return { miscLineItemLabels: [...state.miscLineItemLabels, entry] };
        });
        return entry ?? { id: "", label: "" };
      },

      renameMiscLineItemLabel: (id, label) =>
        set((state) => {
          const trimmed = label.trim();
          if (!trimmed) return state;
          return {
            miscLineItemLabels: state.miscLineItemLabels.map((l) =>
              l.id === id ? { ...l, label: trimmed } : l,
            ),
            vendors: state.vendors.map((v) => {
              if (!v.miscLineItems) return v;
              const next = v.miscLineItems.map((m) =>
                m.id === id ? { ...m, label: trimmed } : m,
              );
              return { ...v, miscLineItems: next };
            }),
          };
        }),

      removeMiscLineItemLabel: (id) =>
        set((state) => ({
          miscLineItemLabels: state.miscLineItemLabels.filter((l) => l.id !== id),
          vendors: state.vendors.map((v) => {
            if (!v.miscLineItems) return v;
            const next = v.miscLineItems.filter((m) => m.id !== id);
            return next.length === v.miscLineItems.length
              ? v
              : { ...v, miscLineItems: next.length ? next : undefined };
          }),
        })),

      setVendorMiscLineItem: (vendorId, item) =>
        set((state) => ({
          vendors: state.vendors.map((v) => {
            if (v.id !== vendorId) return v;
            const existing = v.miscLineItems ?? [];
            const idx = existing.findIndex((m) => m.id === item.id);
            let next: MiscLineItem[];
            if (idx === -1) {
              next = [...existing, item];
            } else {
              next = existing.map((m, i) => (i === idx ? item : m));
            }
            return { ...v, miscLineItems: next };
          }),
        })),

      removeVendor: (id) =>
        set((state) => {
          const vendor = state.vendors.find((v) => v.id === id);
          const newDeletedDomains = [...state.deletedVendorDomains];
          
          // Extract domain from vendor website and add to deleted domains
          if (vendor?.website) {
            try {
              const domain = new URL(vendor.website).hostname.replace(/^www\./, "");
              if (!newDeletedDomains.includes(domain)) {
                newDeletedDomains.push(domain);
              }
            } catch {
              // Invalid URL, skip domain tracking
            }
          }
          
          return {
            vendors: state.vendors.filter((v) => v.id !== id),
            deletedVendorIds: [...state.deletedVendorIds, id],
            deletedVendorDomains: newDeletedDomains,
          };
        }),

      addTask: (task) =>
        set((state) => ({ tasks: [...state.tasks, task] })),

      updateTask: (id, updates) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        })),

      toggleTask: (id) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, done: !t.done } : t
          ),
        })),

      removeTask: (id) =>
        set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) })),

      addGuest: (guest) =>
        set((state) => ({ guests: [...state.guests, guest] })),

      updateGuest: (id, updates) =>
        set((state) => ({
          guests: state.guests.map((g) =>
            g.id === id ? { ...g, ...updates } : g
          ),
        })),

      removeGuest: (id) =>
        set((state) => ({
          guests: state.guests.filter((g) => g.id !== id),
        })),

      addNote: (content) =>
        set((state) => ({
          notes: [
            ...state.notes,
            { id: `note-${Date.now()}`, content, savedAt: new Date().toISOString() },
          ],
        })),

      removeNote: (id) =>
        set((state) => ({ notes: state.notes.filter((n) => n.id !== id) })),

      // Research sessions
      setResearchNotes: (type, notes) =>
        set((state) => ({
          researchSessions: {
            ...state.researchSessions,
            [type]: { ...emptySession(state, type), notes },
          },
        })),

      setResearchRecommendations: (type, recs, fetchedAt) =>
        set((state) => {
          const dismissed = state.dismissedRecommendations[type] ?? [];
          const filtered = recs.filter(
            (r) => !dismissed.includes(r.title.toLowerCase().trim())
          );
          return {
            researchSessions: {
              ...state.researchSessions,
              [type]: { ...emptySession(state, type), recommendations: filtered, fetchedAt },
            },
          };
        }),

      updateRecommendation: (type, id, updates) =>
        set((state) => ({
          researchSessions: {
            ...state.researchSessions,
            [type]: {
              ...emptySession(state, type),
              recommendations: (state.researchSessions[type]?.recommendations ?? []).map((r) =>
                r.id === id ? { ...r, ...updates } : r
              ),
            },
          },
        })),

      removeRecommendation: (type, id) =>
        set((state) => ({
          researchSessions: {
            ...state.researchSessions,
            [type]: {
              ...emptySession(state, type),
              recommendations: (state.researchSessions[type]?.recommendations ?? []).filter(
                (r) => r.id !== id
              ),
            },
          },
        })),

      dismissRecommendation: (type, id, title) =>
        set((state) => {
          const key = title.toLowerCase().trim();
          const already = state.dismissedRecommendations[type] ?? [];
          return {
            researchSessions: {
              ...state.researchSessions,
              [type]: {
                ...emptySession(state, type),
                recommendations: (state.researchSessions[type]?.recommendations ?? []).filter(
                  (r) => r.id !== id
                ),
              },
            },
            dismissedRecommendations: {
              ...state.dismissedRecommendations,
              [type]: already.includes(key) ? already : [...already, key],
            },
          };
        }),

      markRecommendationDismissed: (type, title) =>
        set((state) => {
          const key = title.toLowerCase().trim();
          const already = state.dismissedRecommendations[type] ?? [];
          return {
            dismissedRecommendations: {
              ...state.dismissedRecommendations,
              [type]: already.includes(key) ? already : [...already, key],
            },
          };
        }),

      addResearchChatMessage: (type, msg) =>
        set((state) => ({
          researchSessions: {
            ...state.researchSessions,
            [type]: {
              ...emptySession(state, type),
              chatMessages: [...(state.researchSessions[type]?.chatMessages ?? []), msg],
            },
          },
        })),

      updateLastResearchChat: (type, content) =>
        set((state) => {
          const msgs = [...(state.researchSessions[type]?.chatMessages ?? [])];
          if (msgs.length > 0) msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content };
          return {
            researchSessions: {
              ...state.researchSessions,
              [type]: { ...emptySession(state, type), chatMessages: msgs },
            },
          };
        }),

      clearResearchSession: (type) =>
        set((state) => ({
          researchSessions: {
            ...state.researchSessions,
            [type]: { notes: state.researchSessions[type]?.notes ?? "", recommendations: [], chatMessages: [], fetchedAt: undefined },
          },
        })),

      // Budget overrides
      setBudgetOverride: (id, override) =>
        set((state) => ({
          budgetOverrides: { ...state.budgetOverrides, [id]: override },
        })),

      resetBudgetOverrides: () => set({ budgetOverrides: {} }),

      addCustomBudgetCategory: (name) => {
        const trimmed = name.trim();
        if (!trimmed) return { id: "", name: "", amount: 0, spent: 0 };
        let entry: CustomBudgetCategory | undefined;
        set((state) => {
          // Reuse an existing line rather than creating a duplicate row that
          // would double-count in the allocation total.
          const found = state.customBudgetCategories.find(
            (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
          );
          if (found) {
            entry = found;
            return state;
          }
          entry = {
            id: `custom-${Date.now()}-${state.customBudgetCategories.length}`,
            name: trimmed,
            amount: 0,
            spent: 0,
          };
          return { customBudgetCategories: [...state.customBudgetCategories, entry] };
        });
        return entry ?? { id: "", name: "", amount: 0, spent: 0 };
      },

      updateCustomBudgetCategory: (id, updates) =>
        set((state) => ({
          customBudgetCategories: state.customBudgetCategories.map((c) =>
            c.id === id ? { ...c, ...updates } : c,
          ),
        })),

      removeCustomBudgetCategory: (id) =>
        set((state) => {
          // Drop any stale override keyed to this id so a later line item that
          // somehow reuses the id can't inherit its amounts.
          const { [id]: _dropped, ...restOverrides } = state.budgetOverrides;
          void _dropped;
          return {
            customBudgetCategories: state.customBudgetCategories.filter((c) => c.id !== id),
            budgetOverrides: restOverrides,
          };
        }),

      setTriggerResearchFor: (type) => set({ triggerResearchFor: type }),

      toggleTimelineItem: (id) =>
        set((state) => ({
          timelineDoneIds: state.timelineDoneIds.includes(id)
            ? state.timelineDoneIds.filter((x) => x !== id)
            : [...state.timelineDoneIds, id],
        })),

      // Advisor memory
      setAdvisorMessages: (messages) => set({ advisorMessages: messages }),

      appendAdvisorMessage: (msg) =>
        set((state) => ({ advisorMessages: [...state.advisorMessages, msg] })),

      updateLastAdvisorMessage: (content) =>
        set((state) => {
          const msgs = [...state.advisorMessages];
          if (msgs.length > 0) msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content };
          return { advisorMessages: msgs };
        }),

      setEmailPrefs: (prefs) => set({ emailPrefs: prefs }),

      setActiveTab: (tab) => set({ activeTab: tab }),

      setVendorFilterHideRejected: (hide) => set({ vendorFilterHideRejected: hide }),

      updateComparison: (partial) =>
        set((state) => ({ comparison: { ...state.comparison, ...partial } })),

      updateVenueConfig: (venueId, partial) =>
        set((state) => ({
          comparison: {
            ...state.comparison,
            venueConfigs: {
              ...state.comparison.venueConfigs,
              [venueId]: { ...state.comparison.venueConfigs[venueId], ...partial },
            },
          },
        })),

      setEditingVendorId: (id) => set({ editingVendorId: id }),

      importStore: (data) =>
        set((state) => {
          // Union local + incoming deletion records so deletes from any device stick
          const incomingDeleted = Array.isArray(data.deletedVendorIds)
            ? data.deletedVendorIds
            : [];
          const deletedVendorIds = Array.from(
            new Set([...state.deletedVendorIds, ...incomingDeleted])
          );
          // Strip out any vendor whose id is in the merged deletion list
          const vendorsSource = Array.isArray(data.vendors) ? data.vendors : state.vendors;
          const vendors = vendorsSource.filter((v) => !deletedVendorIds.includes(v.id));
          return {
            ...state,
            ...data,
            vendors,
            deletedVendorIds,
            intakeComplete: !!(data.answers ?? state.answers),
          };
        }),
    }),
    {
      name: "wedding-planner-store",
      version: 9,
      migrate: (persisted, version) => migratePlanStore(persisted, version),
    }
  )
);
