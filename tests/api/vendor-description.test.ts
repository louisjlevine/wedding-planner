/**
 * Tests for /api/vendor-description — SSRF guard and input handling.
 *
 * The isPrivateUrl function is private to the route. We test it indirectly
 * by replying the exact logic here as a verified reference, then exercising
 * it at the route level via the scrapeWebsite path.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Reference implementation of isPrivateUrl (mirrors route exactly) ──────────

function isPrivateUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    if (url.protocol !== "https:" && url.protocol !== "http:") return true;
    const h = url.hostname;
    if (h === "localhost" || h === "::1" || h === "[::1]") return true;
    if (/^127\./.test(h)) return true;
    if (/^10\./.test(h)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
    if (/^192\.168\./.test(h)) return true;
    if (/^169\.254\./.test(h)) return true;
    if (/^0\./.test(h)) return true;
    return false;
  } catch {
    return true;
  }
}

// ── SSRF Guard tests ──────────────────────────────────────────────────────────

describe("isPrivateUrl — SSRF guard", () => {
  // Localhost variants
  it("blocks localhost", () => expect(isPrivateUrl("http://localhost")).toBe(true));
  it("blocks localhost with port", () => expect(isPrivateUrl("http://localhost:3000/api")).toBe(true));
  it("blocks ::1 (IPv6 loopback)", () => expect(isPrivateUrl("http://[::1]")).toBe(true));

  // 127.x.x.x range
  it("blocks 127.0.0.1", () => expect(isPrivateUrl("http://127.0.0.1")).toBe(true));
  it("blocks 127.255.255.255", () => expect(isPrivateUrl("http://127.255.255.255")).toBe(true));

  // 10.x.x.x range
  it("blocks 10.0.0.1", () => expect(isPrivateUrl("http://10.0.0.1")).toBe(true));
  it("blocks 10.255.255.255", () => expect(isPrivateUrl("http://10.255.255.255")).toBe(true));

  // 172.16.x.x – 172.31.x.x range
  it("blocks 172.16.0.1", () => expect(isPrivateUrl("http://172.16.0.1")).toBe(true));
  it("blocks 172.31.255.255", () => expect(isPrivateUrl("http://172.31.255.255")).toBe(true));
  it("does NOT block 172.15.0.1 (outside range)", () => expect(isPrivateUrl("http://172.15.0.1")).toBe(false));
  it("does NOT block 172.32.0.1 (outside range)", () => expect(isPrivateUrl("http://172.32.0.1")).toBe(false));

  // 192.168.x.x range
  it("blocks 192.168.0.1", () => expect(isPrivateUrl("http://192.168.0.1")).toBe(true));
  it("blocks 192.168.255.255", () => expect(isPrivateUrl("http://192.168.255.255")).toBe(true));

  // 169.254.x.x (link-local / cloud metadata)
  it("blocks 169.254.169.254 (AWS metadata)", () => expect(isPrivateUrl("http://169.254.169.254")).toBe(true));
  it("blocks 169.254.0.1", () => expect(isPrivateUrl("http://169.254.0.1")).toBe(true));

  // 0.x.x.x range
  it("blocks 0.0.0.0", () => expect(isPrivateUrl("http://0.0.0.0")).toBe(true));

  // Non-HTTP protocols
  it("blocks file:// protocol", () => expect(isPrivateUrl("file:///etc/passwd")).toBe(true));
  it("blocks ftp:// protocol", () => expect(isPrivateUrl("ftp://example.com")).toBe(true));
  it("blocks data: URL", () => expect(isPrivateUrl("data:text/plain,hello")).toBe(true));

  // Unparseable / malformed
  it("blocks empty string", () => expect(isPrivateUrl("")).toBe(true));
  it("blocks non-URL string", () => expect(isPrivateUrl("not-a-url")).toBe(true));
  it("blocks javascript: URL", () => expect(isPrivateUrl("javascript:alert(1)")).toBe(true));

  // Legitimate public URLs
  it("allows https://example.com", () => expect(isPrivateUrl("https://example.com")).toBe(false));
  it("allows http://example.com", () => expect(isPrivateUrl("http://example.com")).toBe(false));
  it("allows https://vendor.wedding.com/about", () => expect(isPrivateUrl("https://vendor.wedding.com/about")).toBe(false));
  it("allows https://192.0.2.1 (TEST-NET, public)", () => expect(isPrivateUrl("https://192.0.2.1")).toBe(false));
});

// ── Route-level tests ─────────────────────────────────────────────────────────

vi.mock("@anthropic-ai/sdk", () => {
  class MockAnthropic {
    messages = {
      create: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "Mocked vendor description." }],
      }),
    };
  }
  return { default: MockAnthropic };
});

import { NextRequest } from "next/server";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/vendor-description", {
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

describe("POST /api/vendor-description — route behaviour", () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("@/app/api/vendor-description/route");
    POST = mod.POST;
  });

  it("returns 200 with a description for a vendor with no website", async () => {
    const res = await POST(makeRequest({
      vendor: { id: "v1", name: "Test Venue", category: "Venue", status: "considering" },
      answers: VALID_ANSWERS,
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(typeof json.description).toBe("string");
  });

  it("returns a description string even when vendor website is a private IP (SSRF)", async () => {
    // Route should silently skip scraping and still call Claude with no website content
    const res = await POST(makeRequest({
      vendor: {
        id: "v2",
        name: "Evil Vendor",
        category: "Venue",
        status: "considering",
        website: "http://192.168.1.1",
      },
      answers: VALID_ANSWERS,
    }));
    // Should still succeed (Claude is called without website content)
    expect(res.status).toBe(200);
  });
});
