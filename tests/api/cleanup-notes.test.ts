/**
 * Tests for /api/vendors/cleanup-notes — zod validation, AI cleanup, error safety.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => {
  class MockAnthropic {
    messages = { create: mockCreate };
  }
  return { default: MockAnthropic };
});

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/vendors/cleanup-notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/vendors/cleanup-notes", () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.resetModules();
    mockCreate.mockReset();
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "Cleaned-up notes here." }],
    });
    const mod = await import("@/app/api/vendors/cleanup-notes/route");
    POST = mod.POST;
  });

  it("returns 400 when notes is missing", async () => {
    const res = await POST(makeRequest({ vendorName: "Test", category: "Venue" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when notes is empty string", async () => {
    const res = await POST(makeRequest({ notes: "", vendorName: "Test", category: "Venue" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when vendorName is missing", async () => {
    const res = await POST(makeRequest({ notes: "some notes", category: "Venue" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when category is missing", async () => {
    const res = await POST(makeRequest({ notes: "some notes", vendorName: "Test" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is malformed", async () => {
    const req = new NextRequest("http://localhost/api/vendors/cleanup-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns cleaned notes on valid request", async () => {
    const res = await POST(
      makeRequest({ notes: "messy notes here", vendorName: "Sunset Venue", category: "Venue" })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.cleaned).toBe("Cleaned-up notes here.");
  });

  it("calls Claude with vendor context", async () => {
    await POST(
      makeRequest({ notes: "raw notes", vendorName: "Sunset Venue", category: "Photography" })
    );
    expect(mockCreate).toHaveBeenCalledOnce();
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.messages[0].content).toContain("Sunset Venue");
    expect(callArgs.messages[0].content).toContain("Photography");
    expect(callArgs.messages[0].content).toContain("raw notes");
  });

  it("returns 500 when Claude throws", async () => {
    mockCreate.mockRejectedValue(new Error("API error"));
    const res = await POST(
      makeRequest({ notes: "some notes", vendorName: "Test", category: "Venue" })
    );
    expect(res.status).toBe(500);
  });

  it("error response does not expose internal details", async () => {
    mockCreate.mockRejectedValue(new Error("secret internal error"));
    const res = await POST(
      makeRequest({ notes: "some notes", vendorName: "Test", category: "Venue" })
    );
    const text = await res.text();
    expect(text).not.toMatch(/secret internal error/);
    expect(text).not.toMatch(/stack|at Object\./);
  });

  it("returns 400 when notes exceeds 5000 characters", async () => {
    const res = await POST(
      makeRequest({ notes: "x".repeat(5001), vendorName: "Test", category: "Venue" })
    );
    expect(res.status).toBe(400);
  });
});
