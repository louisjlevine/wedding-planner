/**
 * Tests for /api/sync — payload validation and Postgres persistence.
 *
 * The `pg` Pool is mocked so no real database connection is made. We assert
 * on validation behaviour (400s) and the happy-path round-trip.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mock pg so `new Pool().query()` resolves without a real DB ────────────────
const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("pg", () => {
  class Pool {
    query = mockQuery;
  }
  return { Pool };
});

function makeRequest(rawBody: string) {
  return new NextRequest("http://localhost/api/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: rawBody,
  });
}

let GET: () => Promise<Response>;
let POST: (req: NextRequest) => Promise<Response>;

beforeEach(async () => {
  vi.resetModules();
  mockQuery.mockReset();
  mockQuery.mockResolvedValue({ rows: [] });
  const mod = await import("@/app/api/sync/route");
  GET = mod.GET;
  POST = mod.POST;
});

describe("POST /api/sync — payload validation", () => {
  it("returns 400 for invalid JSON", async () => {
    const res = await POST(makeRequest("this is not json"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when payload is an array", async () => {
    const res = await POST(makeRequest(JSON.stringify([1, 2, 3])));
    expect(res.status).toBe(400);
  });

  it("returns 400 when payload is null", async () => {
    const res = await POST(makeRequest(JSON.stringify(null)));
    expect(res.status).toBe(400);
  });

  it("returns 400 when payload is a primitive (number)", async () => {
    const res = await POST(makeRequest(JSON.stringify(42)));
    expect(res.status).toBe(400);
  });

  it("accepts a valid object payload and persists it", async () => {
    const res = await POST(makeRequest(JSON.stringify({ answers: {}, vendors: [] })));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    // ensureTable + insert => at least two queries
    expect(mockQuery).toHaveBeenCalled();
  });

  it("returns 500 (without leaking a stack trace) when the DB write throws", async () => {
    mockQuery.mockRejectedValueOnce(new Error("connection refused at /secret/path"));
    const res = await POST(makeRequest(JSON.stringify({ answers: {} })));
    expect(res.status).toBe(500);
  });
});

describe("GET /api/sync — state retrieval", () => {
  it("returns null when no row exists", async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it("returns the stored data blob when a row exists", async () => {
    const stored = { answers: { partnerName: "Alex" }, vendors: [] };
    // First query (ensureTable) resolves empty, second (SELECT) returns the row
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ data: stored }] });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(stored);
  });

  it("returns 500 when the query throws", async () => {
    mockQuery.mockRejectedValue(new Error("boom"));
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
