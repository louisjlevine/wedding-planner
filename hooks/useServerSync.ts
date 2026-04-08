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
    timelineDoneIds,
    intakeComplete,
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
    timelineDoneIds,
    intakeComplete,
  };
}

/**
 * Syncs the Zustand store to/from the server so state is shared across devices.
 *
 * - On mount: loads saved state from /api/sync and hydrates the store (server wins).
 *   If the server has no data yet, immediately pushes local state up so it isn't lost.
 * - On every store change after hydration: debounces 1.5s then saves to server.
 *
 * Returns a `syncStatus` so the UI can show sync state.
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
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`POST /api/sync ${res.status}: ${body}`);
    }
    setSyncStatus("ok");
  }

  // Load from server on mount
  useEffect(() => {
    async function load() {
      setSyncStatus("loading");
      try {
        const res = await fetch("/api/sync");
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`GET /api/sync ${res.status}: ${body}`);
        }
        const data = await res.json();
        if (data && typeof data === "object" && !("_error" in data)) {
          console.log("[useServerSync] Loaded from server, keys:", Object.keys(data));
          importStore(data);
          setSyncStatus("ok");
        } else {
          // Server is empty or errored — push local state up immediately
          console.log("[useServerSync] No server data, pushing local state up");
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
  }, [store]); // eslint-disable-line react-hooks/exhaustive-deps

  return { syncStatus, syncError };
}
