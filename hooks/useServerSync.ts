"use client";

import { useEffect, useRef, useState } from "react";
import { usePlanStore } from "@/lib/plan-store";

const DEBOUNCE_MS = 1500;

export type SyncStatus = "idle" | "loading" | "saving" | "ok" | "error";

function extractPayload(store: ReturnType<typeof usePlanStore.getState>) {
  const {
    answers,
    vendors,
    tasks,
    guests,
    notes,
    researchSessions,
    advisorMessages,
    budgetOverrides,
    dismissedRecommendations,
    intakeComplete,
    deletedVendorIds,
    miscLineItemLabels,
  } = store;
  return {
    answers,
    vendors,
    tasks,
    guests,
    notes,
    researchSessions,
    advisorMessages,
    budgetOverrides,
    dismissedRecommendations,
    intakeComplete,
    deletedVendorIds,
    miscLineItemLabels,
  };
}

// Guard against test/garbage data in the DB — must look like real app state
function isRealState(data: unknown): boolean {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  const keys = Object.keys(data as object);
  return ["intakeComplete", "answers", "vendors", "tasks", "guests"].some((k) =>
    keys.includes(k)
  );
}

/**
 * Syncs the Zustand store to/from the server so state is shared across devices.
 * Returns syncStatus + a forcePush() function for manual triggering.
 */
export function useServerSync() {
  const store = usePlanStore();
  const importStore = usePlanStore((s) => s.importStore);
  const hydratedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storeRef = useRef(store);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncError, setSyncError] = useState<string | null>(null);
  storeRef.current = store;

  async function saveToServer(payload: object) {
    setSyncStatus("saving");
    // Fetch current server state so we can merge vendors (external imports
    // may have added vendors between the last pull and this push).
    let merged = payload;
    try {
      const getRes = await fetch("/api/sync");
      if (getRes.ok) {
        const serverData = await getRes.json() as Record<string, unknown>;
        const localVendors = (payload as Record<string, unknown>).vendors;
        const serverVendors = serverData.vendors;
        const deletedIds = (payload as Record<string, unknown>).deletedVendorIds;
        const deletedSet = new Set(
          Array.isArray(deletedIds) ? (deletedIds as string[]) : []
        );
        if (Array.isArray(localVendors) && Array.isArray(serverVendors)) {
          const byId = new Map(localVendors.map((v: Record<string, unknown>) => [v.id, v]));
          (serverVendors as Record<string, unknown>[]).forEach((v) => {
            if (byId.has(v.id)) return;
            // Don't resurrect vendors the user deleted locally
            if (deletedSet.has(v.id as string)) return;
            byId.set(v.id, v);
          });
          merged = { ...payload, vendors: Array.from(byId.values()) };
        }
      }
    } catch {
      // Non-fatal — fall back to plain push
    }
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(merged),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`POST /api/sync ${res.status}: ${body}`);
    }
    setSyncStatus("ok");
    console.log("[useServerSync] Saved to server ok");
  }

  async function forcePush() {
    try {
      await saveToServer(extractPayload(storeRef.current));
    } catch (err) {
      const msg = String(err);
      console.error("[useServerSync] Force push failed:", msg);
      setSyncError(msg);
      setSyncStatus("error");
    }
  }

  // Load from server on mount
  useEffect(() => {
    async function load() {
      setSyncStatus("loading");
      console.log("[useServerSync] Loading from server...");
      try {
        const res = await fetch("/api/sync");
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`GET /api/sync ${res.status}: ${body}`);
        }
        const data = await res.json();
        console.log("[useServerSync] Server response:", data);

        if (isRealState(data)) {
          console.log("[useServerSync] Importing server state, keys:", Object.keys(data as object));
          importStore(data);
          setSyncStatus("ok");
        } else {
          // Server has no real state — push local state up immediately
          console.log("[useServerSync] No real state on server, pushing local state up");
          await saveToServer(extractPayload(storeRef.current));
        }
      } catch (err) {
        const msg = String(err);
        console.error("[useServerSync] Load failed:", msg);
        setSyncError(msg);
        setSyncStatus("error");
      } finally {
        hydratedRef.current = true;
      }
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Save to server on store changes (debounced)
  useEffect(() => {
    if (!hydratedRef.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      try {
        await saveToServer(extractPayload(storeRef.current));
      } catch (err) {
        const msg = String(err);
        console.error("[useServerSync] Save failed:", msg);
        setSyncError(msg);
        setSyncStatus("error");
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [store]);  

  return { syncStatus, syncError, forcePush };
}
