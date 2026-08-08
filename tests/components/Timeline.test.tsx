// @vitest-environment happy-dom
/**
 * Render + interaction tests for the Timeline page.
 *
 * Milestones and tasks are one list of `Task` — there is no type distinction
 * left to filter on. Covers: the merged list, date-based grouping, the status
 * filter, adding a task with either date mode, editing a date after the fact,
 * and toggling an adapter-derived task that isn't in the store yet.
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

// Far enough out that every derived item lands in the future.
const WEDDING_YEAR = new Date().getFullYear() + 2;
const ANSWERS: WeddingAnswers = {
  partnerName: "Alex",
  date: `${WEDDING_YEAR}-09-04`,
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
  usePlanStore.setState({ answers: ANSWERS, tasks: [] });
});

afterEach(() => {
  cleanup();
});

describe("Timeline — one merged list", () => {
  it("renders former milestones and former tasks together", () => {
    render(<Timeline />);
    // "Book your venue" used to be a milestone, this one used to be a task.
    expect(screen.getByText("Book your venue")).toBeTruthy();
    expect(screen.getByText("Create a wedding email address")).toBeTruthy();
  });

  it("has no Milestone/Task type badges or type filter", () => {
    render(<Timeline />);
    expect(screen.queryByText("Milestone")).toBeNull();
    expect(screen.queryByRole("button", { name: "Milestones" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Tasks" })).toBeNull();
  });

  it("filters by status over the single list", () => {
    render(<Timeline />);
    // "Set your overall budget" (t2) seeds as done.
    fireEvent.click(screen.getByRole("button", { name: "To do" }));
    expect(screen.queryByText("Set your overall budget")).toBeNull();
    expect(screen.getByText("Book your venue")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByText("Set your overall budget")).toBeTruthy();
    expect(screen.queryByText("Book your venue")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Everything" }));
    expect(screen.getByText("Book your venue")).toBeTruthy();
  });

  it("groups undated items separately from dated ones", () => {
    render(<Timeline />);
    // "Create a wedding email address" has no date in buildInitialTasks.
    expect(screen.getByText("No date yet")).toBeTruthy();
    expect(screen.getByText("Upcoming")).toBeTruthy();
  });

  it("shows how a relatively-scheduled item is dated", () => {
    render(<Timeline />);
    expect(screen.getAllByText("12 months before the wedding").length).toBeGreaterThan(0);
  });

  it("persists a completed item that was never in the store", () => {
    render(<Timeline />);
    fireEvent.click(
      screen.getByRole("button", { name: 'Mark "Create a wedding email address" complete' }),
    );

    expect(usePlanStore.getState().tasks.find((t) => t.id === "t1")?.done).toBe(true);
    expect(
      screen.getByRole("button", { name: 'Mark "Create a wedding email address" incomplete' }),
    ).toBeTruthy();
  });

  it("moves a completed item into the Done group", () => {
    render(<Timeline />);
    fireEvent.click(screen.getByRole("button", { name: 'Mark "Book your venue" complete' }));

    expect(usePlanStore.getState().tasks.find((t) => t.id === "venue")?.done).toBe(true);
    const done = screen.getByText(/^Done — /).parentElement!;
    expect(within(done).getByText("Book your venue")).toBeTruthy();
  });
});

describe("Timeline — adding an item with a date", () => {
  it("adds an undated task", () => {
    render(<Timeline />);
    fireEvent.change(screen.getByLabelText("New task title"), {
      target: { value: "Book hair trial" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    const added = usePlanStore.getState().tasks.find((t) => t.title === "Book hair trial")!;
    expect(added).toBeDefined();
    expect(added.dueDate).toBeUndefined();
    expect(added.monthsBefore).toBeUndefined();
  });

  it("adds a task with an exact date", () => {
    render(<Timeline />);
    fireEvent.change(screen.getByLabelText("New task title"), {
      target: { value: "Dress fitting" },
    });
    fireEvent.click(screen.getByRole("button", { name: "New task: Exact date" }));
    fireEvent.change(screen.getByLabelText("New task exact date"), {
      target: { value: `${WEDDING_YEAR}-01-20` },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    const added = usePlanStore.getState().tasks.find((t) => t.title === "Dress fitting")!;
    expect(added.dueDate).toBe(`${WEDDING_YEAR}-01-20`);
    expect(added.monthsBefore).toBeUndefined();
  });

  it("adds a task dated N months before the wedding", () => {
    render(<Timeline />);
    fireEvent.change(screen.getByLabelText("New task title"), {
      target: { value: "Order the cake" },
    });
    fireEvent.click(screen.getByRole("button", { name: "New task: Months before" }));
    fireEvent.change(screen.getByLabelText("New task months before the wedding"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    const added = usePlanStore.getState().tasks.find((t) => t.title === "Order the cake")!;
    expect(added.monthsBefore).toBe(3);
    expect(added.dueDate).toBeUndefined();
    // Resolved against the wedding date on screen.
    expect(screen.getByText(`Jun 4, ${WEDDING_YEAR}`)).toBeTruthy();
  });
});

describe("Timeline — editing a date after the fact", () => {
  it("switches an adapter item from an offset to an exact date", () => {
    render(<Timeline />);
    fireEvent.click(screen.getByRole("button", { name: 'Edit date for "Book your venue"' }));
    fireEvent.click(screen.getByRole("button", { name: "Book your venue: Exact date" }));
    fireEvent.change(screen.getByLabelText("Book your venue exact date"), {
      target: { value: `${WEDDING_YEAR}-02-14` },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save date" }));

    const stored = usePlanStore.getState().tasks.find((t) => t.id === "venue")!;
    expect(stored.dueDate).toBe(`${WEDDING_YEAR}-02-14`);
    expect(stored.monthsBefore).toBeUndefined();
    expect(screen.getByText(`Feb 14, ${WEDDING_YEAR}`)).toBeTruthy();
  });

  it("changes the offset on a relatively-scheduled item", () => {
    render(<Timeline />);
    fireEvent.click(screen.getByRole("button", { name: 'Edit date for "Book your venue"' }));
    fireEvent.change(screen.getByLabelText("Book your venue months before the wedding"), {
      target: { value: "18" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save date" }));

    const stored = usePlanStore.getState().tasks.find((t) => t.id === "venue")!;
    expect(stored.monthsBefore).toBe(18);
    expect(stored.dueDate).toBeUndefined();
  });

  it("gives an undated item a date", () => {
    render(<Timeline />);
    fireEvent.click(
      screen.getByRole("button", { name: 'Edit date for "Create a wedding email address"' }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Create a wedding email address: Months before" }),
    );
    fireEvent.change(
      screen.getByLabelText("Create a wedding email address months before the wedding"),
      { target: { value: "10" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Save date" }));

    expect(usePlanStore.getState().tasks.find((t) => t.id === "t1")?.monthsBefore).toBe(10);
  });

  it("clears a date back to none", () => {
    render(<Timeline />);
    fireEvent.click(screen.getByRole("button", { name: 'Edit date for "Book your venue"' }));
    fireEvent.click(screen.getByRole("button", { name: "Book your venue: No date" }));
    fireEvent.click(screen.getByRole("button", { name: "Save date" }));

    const stored = usePlanStore.getState().tasks.find((t) => t.id === "venue")!;
    expect(stored.dueDate).toBeUndefined();
    expect(stored.monthsBefore).toBeUndefined();
    expect(stored.daysBefore).toBeUndefined();
  });

  it("edits a user-added task's date without duplicating it", () => {
    usePlanStore.setState({
      tasks: [
        {
          id: "custom-1",
          title: "Book hair trial",
          category: "Custom",
          priority: "medium",
          done: false,
        },
      ],
    });
    render(<Timeline />);
    fireEvent.click(screen.getByRole("button", { name: 'Edit date for "Book hair trial"' }));
    fireEvent.click(screen.getByRole("button", { name: "Book hair trial: Exact date" }));
    fireEvent.change(screen.getByLabelText("Book hair trial exact date"), {
      target: { value: `${WEDDING_YEAR}-08-01` },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save date" }));

    const stored = usePlanStore.getState().tasks.filter((t) => t.id === "custom-1");
    expect(stored).toHaveLength(1);
    expect(stored[0].dueDate).toBe(`${WEDDING_YEAR}-08-01`);
  });
});

describe("Timeline — header summary", () => {
  it("counts the whole plan as one number, not milestones vs tasks", () => {
    render(<Timeline />);
    expect(screen.getByText(/\d+ of \d+ done/)).toBeTruthy();
    expect(screen.queryByText(/milestones done/)).toBeNull();
  });
});
