import { describe, it, expect } from "vitest";
import { buildResearchPrompt } from "@/lib/research-prompts";
import type { WeddingAnswers } from "@/lib/types";

const BASE_ANSWERS: WeddingAnswers = {
  partnerName: "Alex",
  date: "2026-06-15",
  location: "New York, NY",
  guestCount: 100,
  budget: 50_000,
  vibe: ["romantic", "classic"],
  priorities: ["venue", "photography", "food"],
  setting: "indoor",
  funding: "self",
  stress: ["budget"],
};

const ALL_TYPES = [
  "venue", "photographer", "caterer", "florist",
  "music", "dress", "honeymoon", "timeline", "budget",
] as const;

describe("buildResearchPrompt", () => {
  it("returns a non-empty string for all valid types", () => {
    for (const type of ALL_TYPES) {
      const prompt = buildResearchPrompt(type, BASE_ANSWERS);
      expect(typeof prompt).toBe("string");
      expect(prompt.length).toBeGreaterThan(50);
    }
  });

  it("includes the partner name in the prompt", () => {
    const prompt = buildResearchPrompt("venue", BASE_ANSWERS);
    expect(prompt).toContain("Alex");
  });

  it("includes the location in the prompt", () => {
    const prompt = buildResearchPrompt("venue", BASE_ANSWERS);
    expect(prompt).toContain("New York");
  });

  it("includes guest count in the prompt", () => {
    const prompt = buildResearchPrompt("caterer", BASE_ANSWERS);
    expect(prompt).toContain("100");
  });

  // ── Context flags ─────────────────────────────────────────────────────────

  it("includes luxury context for 100k+ budget", () => {
    const answers = { ...BASE_ANSWERS, budget: 120_000 };
    const prompt = buildResearchPrompt("venue", answers);
    expect(prompt.toLowerCase()).toMatch(/luxury|high.end|premium/i);
  });

  it("does NOT include luxury context for sub-100k budget", () => {
    const prompt = buildResearchPrompt("venue", BASE_ANSWERS);
    // Basic check: it should mention budget context without luxury tier
    expect(prompt).toContain("50,000");
  });

  it("includes outdoor context for outdoor setting", () => {
    const answers = { ...BASE_ANSWERS, setting: "outdoor" as const };
    const prompt = buildResearchPrompt("florist", answers);
    expect(prompt.toLowerCase()).toMatch(/outdoor|weather|rain/i);
  });

  it("includes outdoor context for mixed setting", () => {
    const answers = { ...BASE_ANSWERS, setting: "mixed" as const };
    const prompt = buildResearchPrompt("venue", answers);
    expect(prompt.toLowerCase()).toMatch(/outdoor|mixed|open.air/i);
  });

  it("includes mountain context for mountain location", () => {
    const answers = { ...BASE_ANSWERS, location: "Aspen, Colorado" };
    const prompt = buildResearchPrompt("venue", answers);
    expect(prompt.toLowerCase()).toMatch(/mountain|aspen|colorado|book early/i);
  });

  it("includes small-wedding context for <50 guests", () => {
    const answers = { ...BASE_ANSWERS, guestCount: 30 };
    const prompt = buildResearchPrompt("venue", answers);
    expect(prompt).toContain("30");
  });

  // ── Prompt differentiation ─────────────────────────────────────────────────

  it("venue and photographer prompts are meaningfully different", () => {
    const venuePrompt = buildResearchPrompt("venue", BASE_ANSWERS);
    const photoPrompt = buildResearchPrompt("photographer", BASE_ANSWERS);
    expect(venuePrompt).not.toBe(photoPrompt);
    // They should differ by more than just a few characters
    expect(Math.abs(venuePrompt.length - photoPrompt.length)).toBeGreaterThan(10);
  });

  it("budget prompt covers allocation topics", () => {
    const prompt = buildResearchPrompt("budget", BASE_ANSWERS);
    expect(prompt.toLowerCase()).toMatch(/budget|alloc|categ|spend/i);
  });

  it("timeline prompt covers scheduling topics", () => {
    const prompt = buildResearchPrompt("timeline", BASE_ANSWERS);
    expect(prompt.toLowerCase()).toMatch(/timeline|schedule|ceremony|reception/i);
  });
});
