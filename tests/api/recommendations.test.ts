/**
 * Tests for /api/recommendations — JSON parsing, URL filtering, type validation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Hoist mockCreate so it's accessible before module evaluation ──────────────

const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn().mockResolvedValue({
    content: [{ type: "text", text: "[]" }],
  }),
}));

vi.mock("@anthropic-ai/sdk", () => {
  class MockAnthropic {
    messages = { create: mockCreate };
  }
  return { default: MockAnthropic };
});

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/recommendations", {
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

const MOCK_RECS = [
  {
    title: "Great Venue",
    description: "A beautiful space.",
    priceRange: "$5,000–$10,000",
    website: "https://example.com",
    why: "Matches your vibe.",
    status: "open",
  },
];

function setAIResponse(data: unknown) {
  mockCreate.mockResolvedValue({
    content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data) }],
  });
}

// Import the route once (mock is already applied)
import("@/app/api/recommendations/route");

let POST: (req: NextRequest) => Promise<Response>;
beforeEach(async () => {
  mockCreate.mockClear();
  setAIResponse(MOCK_RECS);
  const mod = await import("@/app/api/recommendations/route");
  POST = mod.POST;
});

describe("POST /api/recommendations — validation", () => {
  it("returns 400 for missing type", async () => {
    const res = await POST(makeRequest({ answers: VALID_ANSWERS }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid type", async () => {
    const res = await POST(makeRequest({ type: "evil", answers: VALID_ANSWERS }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when answers is missing", async () => {
    const res = await POST(makeRequest({ type: "venue" }));
    expect(res.status).toBe(400);
  });

  it("returns 200 with valid input and parses recommendations array", async () => {
    const res = await POST(makeRequest({ type: "venue", notes: "", answers: VALID_ANSWERS }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.recommendations)).toBe(true);
  });
});

describe("POST /api/recommendations — URL security filtering", () => {
  it("strips http:// URLs from AI response (only https:// allowed)", async () => {
    setAIResponse([{ ...MOCK_RECS[0], website: "http://insecure.com" }]);
    const res = await POST(makeRequest({ type: "venue", notes: "", answers: VALID_ANSWERS }));
    const json = await res.json();
    expect(json.recommendations[0].website).toBeUndefined();
  });

  it("passes through valid https:// URLs", async () => {
    setAIResponse(MOCK_RECS);
    const res = await POST(makeRequest({ type: "venue", notes: "", answers: VALID_ANSWERS }));
    const json = await res.json();
    expect(json.recommendations[0].website).toBe("https://example.com");
  });

  it("strips malformed URLs from AI response", async () => {
    setAIResponse([{ ...MOCK_RECS[0], website: "not-a-url" }]);
    const res = await POST(makeRequest({ type: "venue", notes: "", answers: VALID_ANSWERS }));
    const json = await res.json();
    expect(json.recommendations[0].website).toBeUndefined();
  });

  it("strips empty string website", async () => {
    setAIResponse([{ ...MOCK_RECS[0], website: "" }]);
    const res = await POST(makeRequest({ type: "venue", notes: "", answers: VALID_ANSWERS }));
    const json = await res.json();
    expect(json.recommendations[0].website).toBeUndefined();
  });
});

describe("POST /api/recommendations — JSON parsing resilience", () => {
  it("handles AI wrapping JSON in ```json code block", async () => {
    setAIResponse("```json\n" + JSON.stringify(MOCK_RECS) + "\n```");
    const res = await POST(makeRequest({ type: "venue", notes: "", answers: VALID_ANSWERS }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.recommendations)).toBe(true);
    expect(json.recommendations.length).toBe(1);
  });

  it("handles AI wrapping JSON in plain ``` code block", async () => {
    setAIResponse("```\n" + JSON.stringify(MOCK_RECS) + "\n```");
    const res = await POST(makeRequest({ type: "venue", notes: "", answers: VALID_ANSWERS }));
    expect(res.status).toBe(200);
  });

  it("handles direct JSON array without code block", async () => {
    setAIResponse(MOCK_RECS);
    const res = await POST(makeRequest({ type: "venue", notes: "", answers: VALID_ANSWERS }));
    expect(res.status).toBe(200);
  });

  it("returns 500 when AI returns completely unparseable text", async () => {
    setAIResponse("I cannot provide recommendations at this time.");
    const res = await POST(makeRequest({ type: "venue", notes: "", answers: VALID_ANSWERS }));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/recommendations — status normalisation", () => {
  it("maps 'open' status correctly", async () => {
    setAIResponse([{ ...MOCK_RECS[0], status: "open" }]);
    const res = await POST(makeRequest({ type: "venue", notes: "", answers: VALID_ANSWERS }));
    const json = await res.json();
    expect(json.recommendations[0].status).toBe("open");
  });

  it("maps 'closed' status correctly", async () => {
    setAIResponse([{ ...MOCK_RECS[0], status: "closed" }]);
    const res = await POST(makeRequest({ type: "venue", notes: "", answers: VALID_ANSWERS }));
    const json = await res.json();
    expect(json.recommendations[0].status).toBe("closed");
  });

  it("maps unknown/random status to 'unknown'", async () => {
    setAIResponse([{ ...MOCK_RECS[0], status: "maybe" }]);
    const res = await POST(makeRequest({ type: "venue", notes: "", answers: VALID_ANSWERS }));
    const json = await res.json();
    expect(json.recommendations[0].status).toBe("unknown");
  });

  it("each recommendation has a unique id", async () => {
    setAIResponse([MOCK_RECS[0], MOCK_RECS[0]]);
    const res = await POST(makeRequest({ type: "venue", notes: "", answers: VALID_ANSWERS }));
    const json = await res.json();
    const ids = json.recommendations.map((r: { id: string }) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
