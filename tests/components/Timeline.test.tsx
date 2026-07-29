// @vitest-environment happy-dom
/**
 * Render + interaction tests for the combined Timeline & Tasks page.
 *
 * Covers: milestones and tasks share one list (no sub-tabs), date-based
 * grouping, the filter chips, adding a custom task, and toggling an
 * adapter-derived task that isn't in the store yet.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import type { WeddingAnswers } from "@/lib/types";

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

const { usePlanStore } = await import("@/lib/plan-store");
const { Timeline } = await import("@/components/sections/Timeline");

// Far enough out that every derived milestone lands in the future.
const ANSWERS: WeddingAnswers = {
  partnerName: "Alex",
  date: `${new Date().getFullYear() + 2}-09-04`,
  dateIsExact: true,
  location: "Nashville, TN",
  guestCount: 100,
  budget: 50_000,
  vibe: ["romantic"],
  priorities: ["venue", "photography", "food"],
  setting: "indoor",
  funding: "self",
  stress: ["budget"],
};

beforeEach(() => {
  usePlanStore.setState({ answers: ANSWERS, tasks: [], timelineDoneIds: [] });
});

afterEach(() => {
  cleanup();
});

describe("Timeline & Tasks — combined page", () => {
  it("renders milestones and tasks together on one page", () => {
    render(<Timeline />);
    // Milestone from buildTimeline
    expect(screen.getByText("Book your venue")).toBeTruthy();
    // Task from buildInitialTasks
    expect(screen.getByText("Create a wedding email address")).toBeTruthy();
  });

  it("has no milestones/tasks sub-tabs — only a filter over the single list", () => {
    render(<Timeline />);
    expect(screen.getByRole("button", { name: "Everything" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Milestones" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tasks" })).toBeTruthy();
  });

  it("filters down to milestones only, then back to everything", () => {
    render(<Timeline />);
    fireEvent.click(screen.getByRole("button", { name: "Milestones" }));
    expect(screen.getByText("Book your venue")).toBeTruthy();
    expect(screen.queryByText("Create a wedding email address")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Everything" }));
    expect(screen.getByText("Create a wedding email address")).toBeTruthy();
  });

  it("filters down to tasks only", () => {
    render(<Timeline />);
    fireEvent.click(screen.getByRole("button", { name: "Tasks" }));
    expect(screen.getByText("Create a wedding email address")).toBeTruthy();
    expect(screen.queryByText("Book your venue")).toBeNull();
  });

  it("groups undated tasks separately from dated items", () => {
    render(<Timeline />);
    // "Create a wedding email address" has no dueDate in buildInitialTasks.
    expect(screen.getByText("No date yet")).toBeTruthy();
    expect(screen.getByText("Upcoming")).toBeTruthy();
  });

  it("adds a custom task to the same list", () => {
    render(<Timeline />);
    fireEvent.change(screen.getByLabelText("New task title"), {
      target: { value: "Book hair trial" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(screen.getByText("Book hair trial")).toBeTruthy();
    expect(usePlanStore.getState().tasks.map((t) => t.title)).toContain("Book hair trial");
  });

  it("persists a completed adapter task that was never in the store", () => {
    render(<Timeline />);
    fireEvent.click(
      screen.getByRole("button", { name: 'Mark "Create a wedding email address" complete' }),
    );

    const stored = usePlanStore.getState().tasks.find((t) => t.id === "t1");
    expect(stored?.done).toBe(true);
    expect(
      screen.getByRole("button", { name: 'Mark "Create a wedding email address" incomplete' }),
    ).toBeTruthy();
  });

  it("moves a completed milestone into the Done group", () => {
    render(<Timeline />);
    fireEvent.click(screen.getByRole("button", { name: 'Mark "Book your venue" complete' }));

    expect(usePlanStore.getState().timelineDoneIds).toContain("venue");
    const done = screen.getByText(/^Done — /).parentElement!;
    expect(within(done).getByText("Book your venue")).toBeTruthy();
  });

  it("summarises milestone and task progress in the header", () => {
    render(<Timeline />);
    expect(screen.getByText(/milestones done · .* tasks done/)).toBeTruthy();
  });
});
