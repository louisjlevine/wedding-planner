/**
 * Tests for /api/feedback — zod validation, input length limits, Linear integration.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock Anthropic
vi.mock("@anthropic-ai/sdk", () => {
  class MockAnthropic {
    messages = {
      create: vi.fn().mockResolvedValue({
        content: [{
          type: "text",
          text: JSON.stringify({ title: "Test feedback", description: "Details", priority: "medium" }),
        }],
      }),
    };
  }
  return { default: MockAnthropic };
});

// Mock fetch for Linear GraphQL call
const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({
    data: { issueCreate: { success: true, issue: { url: "https://linear.app/issue/123" } } },
  }),
});
vi.stubGlobal("fetch", mockFetch);

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/feedback — zod validation", () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.resetModules();
    // Re-stub after module reset
    vi.stubGlobal("fetch", mockFetch);
    const mod = await import("@/app/api/feedback/route");
    POST = mod.POST;
  });

  it("returns 400 when feedback is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when feedback is empty string", async () => {
    const res = await POST(makeRequest({ feedback: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when feedback exceeds 2000 characters", async () => {
    const res = await POST(makeRequest({ feedback: "x".repeat(2001) }));
    expect(res.status).toBe(400);
  });

  it("accepts feedback at exactly 2000 characters", async () => {
    const res = await POST(makeRequest({ feedback: "x".repeat(2000) }));
    // May fail due to missing LINEAR_API_KEY env, but should pass validation (not 400)
    expect(res.status).not.toBe(400);
  });

  it("accepts valid feedback", async () => {
    const res = await POST(makeRequest({ feedback: "The budget section is hard to use." }));
    expect(res.status).not.toBe(400);
  });

  it("returns 400 when feedback is a number (wrong type)", async () => {
    const res = await POST(makeRequest({ feedback: 12345 }));
    expect(res.status).toBe(400);
  });

  it("error response does not expose internal details", async () => {
    const res = await POST(makeRequest({ feedback: "" }));
    const text = await res.text();
    expect(text).not.toMatch(/stack|Error:|at Object\./);
  });
});
