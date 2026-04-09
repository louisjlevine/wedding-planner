/**
 * Tests for /api/research route — input validation without hitting Anthropic.
 *
 * Strategy: import the handler directly and mock the Anthropic SDK so no
 * real network calls are made.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mock Anthropic before importing the route ─────────────────────────────────

vi.mock("@anthropic-ai/sdk", () => {
  const mockCreate = vi.fn().mockResolvedValue({
    content: [{ type: "text", text: "Mocked research result" }],
  });
  class MockAnthropic {
    messages = { create: mockCreate };
  }
  return { default: MockAnthropic };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/research", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_ANSWERS = {
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/research — input validation", () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.resetModules();
    // Re-import after reset to get a fresh module with the mock in place
    const mod = await import("@/app/api/research/route");
    POST = mod.POST;
  });

  it("returns 400 for missing type", async () => {
    const res = await POST(makeRequest({ answers: VALID_ANSWERS }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for an unrecognised research type", async () => {
    const res = await POST(makeRequest({ type: "unicorn", answers: VALID_ANSWERS }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when answers is missing", async () => {
    const res = await POST(makeRequest({ type: "venue" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when answers is not an object (string)", async () => {
    const res = await POST(makeRequest({ type: "venue", answers: "not-an-object" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when answers is null", async () => {
    const res = await POST(makeRequest({ type: "venue", answers: null }));
    expect(res.status).toBe(400);
  });

  it("returns 200 for a valid type and answers", async () => {
    const res = await POST(makeRequest({ type: "venue", answers: VALID_ANSWERS }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(typeof json.result).toBe("string");
  });

  it("accepts all valid research types", async () => {
    const validTypes = [
      "venue", "photographer", "caterer", "florist",
      "music", "dress", "honeymoon", "timeline", "budget",
    ];
    for (const type of validTypes) {
      const res = await POST(makeRequest({ type, answers: VALID_ANSWERS }));
      expect(res.status).toBe(200);
    }
  });

  it("error response does not leak stack traces", async () => {
    const res = await POST(makeRequest({ type: "injected<script>", answers: VALID_ANSWERS }));
    const text = await res.text();
    expect(text).not.toMatch(/at Object\.|Error:|stack/);
  });
});
