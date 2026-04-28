// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { Vendor } from "@/lib/types";

// Zustand persist middleware needs a localStorage shim. happy-dom provides
// one, but we also reset it between tests so persisted state can't leak.
const { usePlanStore } = await import("@/lib/plan-store");
const { useServerSync } = await import("@/hooks/useServerSync");

// Console noise from the hook isn't useful in tests.
vi.spyOn(console, "log").mockImplementation(() => {});

const richVendor: Vendor = {
  id: "v1",
  category: "Venue",
  name: "The Barn",
  status: "considering",
  costModel: { base: 12000, hoursIncluded: 8, overtimeHourly: 750 },
  miscLineItems: [{ id: "m1", label: "Cleanup", cost: 500 }],
  packages: [],
  attachments: [],
};

// Pared-down server snapshot of the same vendor (e.g. saved before the
// user filled in cost details). This is the shape that used to clobber
// local edits when mergeVendors did a wholesale replace.
const strippedServerVendor: Vendor = {
  id: "v1",
  category: "Venue",
  name: "The Barn",
  status: "considering",
};

type FetchHandler = (url: string, init?: RequestInit) => Promise<Response>;

function installFetch(handler: FetchHandler) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      return handler(url, init);
    }),
  );
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Decode the body of a fetch POST so we can assert on the payload.
function readPostBody(call: { args: [string, RequestInit?] }): Record<string, unknown> {
  const init = call.args[1];
  return JSON.parse(String(init?.body ?? "{}"));
}

beforeEach(() => {
  // Fresh store per test — clear localStorage and reset slices we touch.
  localStorage.clear();
  usePlanStore.setState({
    answers: { partnerName: "Alex", date: "2026-06-15", location: "NYC", guestCount: 100, budget: 50000, vibe: ["classic"], priorities: ["venue", "photography", "food"], setting: "indoor", funding: "self", stress: [] },
    vendors: [],
    tasks: [],
    guests: [],
    notes: [],
    researchSessions: {},
    advisorMessages: [],
    budgetOverrides: {},
    dismissedRecommendations: {},
    timelineDoneIds: [],
    intakeComplete: true,
    deletedVendorIds: [],
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("useServerSync — push payload integrity", () => {
  it("debounces store changes and pushes a single POST after 1.5s", async () => {
    vi.useFakeTimers();
    installFetch(async (url, init) => {
      // Mount load returns real-looking state so the hook does NOT
      // immediately push local up — that path is exercised separately.
      if (!init || init.method !== "POST") {
        return jsonResponse({
          intakeComplete: true,
          answers: usePlanStore.getState().answers,
          vendors: [],
          tasks: [],
          guests: [],
        });
      }
      return jsonResponse({ ok: true });
    });

    renderHook(() => useServerSync());

    // Let mount-time `load()` resolve.
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    // Three rapid edits should collapse into one POST.
    act(() => {
      usePlanStore.getState().addVendor(richVendor);
      usePlanStore.getState().updateVendor("v1", { name: "The Barn II" });
      usePlanStore.getState().updateVendor("v1", { name: "The Barn III" });
    });

    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    // Drain microtasks for the GET-then-POST chain inside saveToServer.
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const posts = fetchMock.mock.calls.filter(
      (c) => (c[1] as RequestInit | undefined)?.method === "POST",
    );
    expect(posts).toHaveLength(1);
  });

  it("pushed payload preserves local cost fields when server has a stripped snapshot", async () => {
    vi.useFakeTimers();
    installFetch(async (url, init) => {
      if (!init || init.method !== "POST") {
        // Both the mount load AND the pre-push GET inside saveToServer hit
        // this path. Return a stripped server snapshot — the same shape that
        // used to wipe local edits before the mergeVendors fix.
        return jsonResponse({
          intakeComplete: true,
          answers: usePlanStore.getState().answers,
          vendors: [strippedServerVendor],
          tasks: [],
          guests: [],
        });
      }
      return jsonResponse({ ok: true });
    });

    renderHook(() => useServerSync());

    // Mount load runs first. Importing the stripped server snapshot is
    // what `useServerSync` does on mount — it overlays it via importStore.
    // Then we add the rich vendor locally to simulate the user filling in
    // cost details.
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    act(() => {
      // Mimic an in-place edit: replace the server-shaped vendor with the
      // rich local copy that has miscLineItems + costModel.
      usePlanStore.setState({ vendors: [richVendor] });
    });

    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const post = fetchMock.mock.calls.find(
      (c) => (c[1] as RequestInit | undefined)?.method === "POST",
    );
    expect(post).toBeDefined();
    const body = readPostBody({ args: post as [string, RequestInit?] });
    const vendors = body.vendors as Vendor[];
    expect(vendors).toHaveLength(1);
    expect(vendors[0].miscLineItems).toEqual(richVendor.miscLineItems);
    expect(vendors[0].costModel).toEqual(richVendor.costModel);
  });

  it("preserves local fields end-to-end when a poll-style mergeVendors lands mid-debounce", async () => {
    vi.useFakeTimers();
    installFetch(async (url, init) => {
      if (!init || init.method !== "POST") {
        return jsonResponse({
          intakeComplete: true,
          answers: usePlanStore.getState().answers,
          vendors: [strippedServerVendor],
          tasks: [],
          guests: [],
        });
      }
      return jsonResponse({ ok: true });
    });

    renderHook(() => useServerSync());
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    // 1. User adds the rich vendor.
    act(() => { usePlanStore.getState().addVendor(richVendor); });

    // 2. Halfway through the debounce, the Vendors-tab poll fires and
    //    mergeVendors gets the stale server snapshot. With the fix this
    //    is now non-destructive — local fields must survive.
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    act(() => {
      usePlanStore.getState().mergeVendors([strippedServerVendor]);
    });

    // 3. Debounce finishes; saveToServer pushes.
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    const localVendor = usePlanStore.getState().vendors[0];
    expect(localVendor.miscLineItems).toEqual(richVendor.miscLineItems);
    expect(localVendor.costModel).toEqual(richVendor.costModel);

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const post = fetchMock.mock.calls.find(
      (c) => (c[1] as RequestInit | undefined)?.method === "POST",
    );
    const body = readPostBody({ args: post as [string, RequestInit?] });
    const pushed = (body.vendors as Vendor[])[0];
    expect(pushed.miscLineItems).toEqual(richVendor.miscLineItems);
    expect(pushed.costModel).toEqual(richVendor.costModel);
  });

  it("pre-push merge keeps externally-imported server vendors that aren't local", async () => {
    vi.useFakeTimers();
    const externalVendor: Vendor = {
      id: "vendor-from-shortcut",
      category: "Photography",
      name: "Imported via iOS",
      status: "considering",
    };
    installFetch(async (url, init) => {
      if (!init || init.method !== "POST") {
        // Mount-time load returns no real state so the hook pushes local
        // up. Subsequent GETs (pre-push merge) include the externally
        // imported vendor that the iOS shortcut wrote between pull and push.
        const callsSoFar = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.length;
        if (callsSoFar <= 1) return jsonResponse(null);
        return jsonResponse({
          intakeComplete: true,
          vendors: [externalVendor],
          tasks: [],
          guests: [],
        });
      }
      return jsonResponse({ ok: true });
    });

    renderHook(() => useServerSync());
    // First load triggers an immediate push (because server returned no
    // real state). Drain it.
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    // Now make a local change — debounced push will run the pre-push merge
    // and should pull in the iOS-shortcut vendor without dropping local.
    act(() => { usePlanStore.getState().addVendor(richVendor); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const posts = fetchMock.mock.calls.filter(
      (c) => (c[1] as RequestInit | undefined)?.method === "POST",
    );
    const lastPost = posts[posts.length - 1];
    const body = readPostBody({ args: lastPost as [string, RequestInit?] });
    const ids = (body.vendors as Vendor[]).map((v) => v.id).sort();
    expect(ids).toEqual(["v1", "vendor-from-shortcut"]);
  });

  it("pre-push merge does not resurrect locally-deleted vendors", async () => {
    vi.useFakeTimers();
    const ghostVendor: Vendor = {
      id: "vendor-deleted",
      category: "Florist",
      name: "Should stay dead",
      status: "considering",
    };
    installFetch(async (url, init) => {
      if (!init || init.method !== "POST") {
        const callsSoFar = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.length;
        if (callsSoFar <= 1) return jsonResponse(null);
        return jsonResponse({
          intakeComplete: true,
          vendors: [ghostVendor],
          tasks: [],
          guests: [],
        });
      }
      return jsonResponse({ ok: true });
    });

    usePlanStore.setState({ deletedVendorIds: ["vendor-deleted"] });
    renderHook(() => useServerSync());
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    act(() => { usePlanStore.getState().addVendor(richVendor); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const posts = fetchMock.mock.calls.filter(
      (c) => (c[1] as RequestInit | undefined)?.method === "POST",
    );
    const lastPost = posts[posts.length - 1];
    const body = readPostBody({ args: lastPost as [string, RequestInit?] });
    const ids = (body.vendors as Vendor[]).map((v) => v.id);
    expect(ids).not.toContain("vendor-deleted");
  });
});
