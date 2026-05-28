/**
 * Tests for /api/vendors/email — inbound Resend webhook auth & event filtering.
 *
 * Focuses on the security-critical paths: the shared-secret gate and the
 * event-type filter. The route logs verbosely, so console.log is silenced.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const SECRET = "inbound-secret";

function makeRequest(body: unknown, query = `?secret=${SECRET}`) {
  return new NextRequest(`http://localhost/api/vendors/email${query}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

let POST: (req: NextRequest) => Promise<Response>;

beforeEach(async () => {
  vi.resetModules();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubEnv("INBOUND_WEBHOOK_SECRET", SECRET);
  const mod = await import("@/app/api/vendors/email/route");
  POST = mod.POST;
});

describe("POST /api/vendors/email — auth", () => {
  it("returns 401 when no secret is provided", async () => {
    const res = await POST(makeRequest({ type: "email.received" }, ""));
    expect(res.status).toBe(401);
  });

  it("returns 401 when the secret is wrong", async () => {
    const res = await POST(makeRequest({ type: "email.received" }, "?secret=wrong"));
    expect(res.status).toBe(401);
  });

  it("returns 401 when no INBOUND_WEBHOOK_SECRET is configured", async () => {
    vi.stubEnv("INBOUND_WEBHOOK_SECRET", "");
    vi.resetModules();
    const mod = await import("@/app/api/vendors/email/route");
    const res = await mod.POST(makeRequest({ type: "email.received" }));
    expect(res.status).toBe(401);
  });
});

describe("POST /api/vendors/email — request handling", () => {
  it("returns 400 for invalid JSON", async () => {
    const res = await POST(makeRequest("not json at all"));
    expect(res.status).toBe(400);
  });

  it("ignores non-inbound events with a 200 and imported:0", async () => {
    const res = await POST(makeRequest({ type: "email.delivered", data: {} }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.imported).toBe(0);
  });

  it("ignores an inbound event with no email_id", async () => {
    const res = await POST(makeRequest({ type: "email.received", data: {} }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.imported).toBe(0);
  });
});
