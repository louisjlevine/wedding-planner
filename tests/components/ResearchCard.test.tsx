// @vitest-environment happy-dom
/**
 * Render + interaction tests for ResearchCard — the sole AI-prose renderer.
 *
 * Covers: render without crashing, the empty-state CTA, the research fetch
 * happy path, and the error path. `fetch` is mocked; no network is hit.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { ResearchCard } from "@/components/ui/ResearchCard";
import type { WeddingAnswers } from "@/lib/types";

const ANSWERS: WeddingAnswers = {
  partnerName: "Alex",
  date: "2026-06-15",
  location: "New York, NY",
  guestCount: 100,
  budget: 50_000,
  vibe: ["romantic"],
  priorities: ["venue", "photography", "food"],
  setting: "indoor",
  funding: "self",
  stress: ["budget"],
};

function renderCard() {
  return render(
    <ResearchCard
      type="venue"
      title="Venue Research"
      description="Find the right venue"
      answers={ANSWERS}
    />,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ResearchCard", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders the title and description without crashing", () => {
    renderCard();
    expect(screen.getByText("Venue Research")).toBeTruthy();
    expect(screen.getByText("Find the right venue")).toBeTruthy();
  });

  it("shows the empty-state CTA before research is fetched", () => {
    renderCard();
    expect(screen.getByRole("button", { name: "Get Research" })).toBeTruthy();
  });

  it("fetches research and renders the result on click", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ result: "Top venues in your area." }),
    });
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Get Research" }));

    await waitFor(() => {
      expect(screen.getByText("Top venues in your area.")).toBeTruthy();
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/research",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("shows an error message and a retry button when the request fails", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false });
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Get Research" }));

    await waitFor(() => {
      expect(screen.getByText(/Failed to load research/i)).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });
});
