/**
 * Tests for /api/vendors/import — auth gate, SSRF guard, validation, happy path.
 *
 * Mocks: pg (no DB), Anthropic SDK (no AI call), global fetch (no scrape).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockQuery, mockCreate } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockCreate: vi.fn(),
}));

vi.mock("pg", () => {
  class Pool {
    query = mockQuery;
  }
  return { Pool };
});

vi.mock("@anthropic-ai/sdk", () => {
  class MockAnthropic {
    messages = { create: mockCreate };
  }
  return { default: MockAnthropic };
});

const IMPORT_TOKEN = "test-import-token";

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/vendors/import", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function authHeaders() {
  return { Authorization: `Bearer ${IMPORT_TOKEN}` };
}

let POST: (req: NextRequest) => Promise<Response>;

beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv("IMPORT_TOKEN", IMPORT_TOKEN);
  vi.stubEnv("SESSION_TOKEN", "");
  mockQuery.mockReset();
  mockQuery.mockResolvedValue({ rows: [] });
  mockCreate.mockReset();
  mockCreate.mockResolvedValue({
    content: [{
      type: "text",
      text: JSON.stringify({
        name: "Sunny Studios",
        category: "Photography",
        contact: "hi@sunny.com",
        price: 4000,
        notes: "Bright, candid documentary style.",
      }),
    }],
  });
  // Default: scrape fetch returns a non-ok response (route tolerates empty body)
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, text: async () => "" }));
  const mod = await import("@/app/api/vendors/import/route");
  POST = mod.POST;
});

describe("POST /api/vendors/import — auth", () => {
  it("returns 401 with no credentials", async () => {
    const res = await POST(makeRequest({ url: "https://sunny.com" }));
    expect(res.status).toBe(401);
  });

  it("returns 401 with a wrong bearer token", async () => {
    const res = await POST(makeRequest({ url: "https://sunny.com" }, { Authorization: "Bearer nope" }));
    expect(res.status).toBe(401);
  });
});

describe("POST /api/vendors/import — validation & SSRF", () => {
  it("returns 400 when url is missing", async () => {
    const res = await POST(makeRequest({}, authHeaders()));
    expect(res.status).toBe(400);
  });

  it("returns 400 when url is blank", async () => {
    const res = await POST(makeRequest({ url: "   " }, authHeaders()));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a private/loopback URL (SSRF guard)", async () => {
    const res = await POST(makeRequest({ url: "http://localhost:3000/admin" }, authHeaders()));
    expect(res.status).toBe(400);
  });

  it("returns 400 for an internal 169.254 URL (SSRF guard)", async () => {
    const res = await POST(makeRequest({ url: "http://169.254.169.254/latest/meta-data" }, authHeaders()));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/vendors/import — happy path", () => {
  it("creates a new vendor from a public URL", async () => {
    const res = await POST(makeRequest({ url: "https://sunny.com" }, authHeaders()));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.matched).toBe(false);
    expect(json.vendor.name).toBe("Sunny Studios");
    expect(json.vendor.category).toBe("Photography");
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it("coerces an unknown AI category to 'Other'", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ name: "X", category: "Spaceship", contact: null, price: null, notes: "" }) }],
    });
    const res = await POST(makeRequest({ url: "https://sunny.com" }, authHeaders()));
    const json = await res.json();
    expect(json.vendor.category).toBe("Other");
  });

  it("falls back gracefully when the AI returns unparseable text", async () => {
    mockCreate.mockResolvedValue({ content: [{ type: "text", text: "I cannot help with that." }] });
    const res = await POST(makeRequest({ url: "https://sunny.com" }, authHeaders()));
    expect(res.status).toBe(200);
    const json = await res.json();
    // hostname fallback, category coerced to Other
    expect(json.vendor.category).toBe("Other");
  });

  it("skips re-import of a previously deleted domain", async () => {
    mockQuery.mockResolvedValue({
      rows: [{ data: { vendors: [], deletedVendorDomains: ["sunny.com"] } }],
    });
    const res = await POST(makeRequest({ url: "https://sunny.com" }, authHeaders()));
    const json = await res.json();
    expect(json.vendor).toBeNull();
    expect(json.matched).toBe(false);
  });
});
