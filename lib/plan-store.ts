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
} from "./types";

interface BudgetOverride {
  percentage: number; // user-set allocation %
  spent: number;      // user-tracked spend
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
  dismissedRecommendations: Record<string, string[]>; // type → [lowercased title, ...]
  triggerResearchFor: string | null; // set by Vendors "Find similar" to auto-fetch
  timelineDoneIds: string[];
  activeTab: Tab;
  intakeComplete: boolean;
  vendorFilterHideRejected: boolean;
  deletedVendorIds: string[]; // track locally-deleted vendors to prevent re-import
  deletedVendorDomains: string[]; // track domains of deleted vendors to prevent re-import

  setAnswers: (answers: WeddingAnswers) => void;
  updateAnswers: (partial: Partial<WeddingAnswers>) => void;
  resetIntake: () => void;

  addVendor: (vendor: Vendor) => void;
  updateVendor: (id: string, updates: Partial<Vendor>) => void;
  removeVendor: (id: string) => void;
  mergeVendors: (incoming: Vendor[]) => void;

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

  // Research trigger from Vendors
  setTriggerResearchFor: (type: string | null) => void;

  // Timeline done state
  toggleTimelineItem: (id: string) => void;

  emailPrefs: EmailDigestPrefs | null;
  setEmailPrefs: (prefs: EmailDigestPrefs) => void;

  setActiveTab: (tab: Tab) => void;
  setVendorFilterHideRejected: (hide: boolean) => void;
  importStore: (data: Partial<PlanState>) => void;
}

function emptySession(state: PlanState, type: string): ResearchSession {
  return state.researchSessions[type] ?? { notes: "", recommendations: [], chatMessages: [] };
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
      dismissedRecommendations: {},
      triggerResearchFor: null,
      timelineDoneIds: [],
      activeTab: "overview",
      intakeComplete: false,
      emailPrefs: null,
      vendorFilterHideRejected: true,
      deletedVendorIds: [],
      deletedVendorDomains: [],

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

      // Merge incoming vendors from server — adds new ones (by id), updates existing
      // But skip any vendors that were locally deleted to prevent re-import
      mergeVendors: (incoming) =>
        set((state) => {
          const localById = new Map(state.vendors.map((v) => [v.id, v]));
          incoming.forEach((v) => {
            // Skip vendors that were locally deleted
            if (!state.deletedVendorIds.includes(v.id)) {
              localById.set(v.id, v);
            }
          });
          return { vendors: Array.from(localById.values()) };
        }),

      updateVendor: (id, updates) =>
        set((state) => ({
          vendors: state.vendors.map((v) =>
            v.id === id ? { ...v, ...updates } : v
          ),
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
      version: 1,
      migrate: (persisted, version) => {
        const state = (persisted as Partial<PlanState>) ?? {};
        if (version < 1) {
          state.vendorFilterHideRejected = true;
        }
        return state as PlanState;
      },
    }
  )
);
