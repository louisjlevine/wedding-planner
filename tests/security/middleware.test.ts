/**
 * Security tests for middleware.ts — rate limiting, bot UA blocking, CORS, session auth.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// Helper to build a NextRequest that middleware can process
function makeReq(
  path: string,
  options: {
    method?: string;
    ua?: string;
    origin?: string;
    session?: string;
    ip?: string;
    sessionToken?: string;
  } = {}
) {
  const {
    method = "GET",
    ua = "Mozilla/5.0 (compatible; TestBrowser/1.0)",
    origin,
    session,
    ip = "1.2.3.4",
    sessionToken,
  } = options;

  const headers: Record<string, string> = {
    "user-agent": ua,
    "x-forwarded-for": ip,
  };
  if (origin) headers["origin"] = origin;
  if (session) headers["cookie"] = `session=${session}`;

  if (sessionToken) {
    process.env.SESSION_TOKEN = sessionToken;
  }

  return new NextRequest(`http://localhost${path}`, { method, headers });
}

describe("middleware — bot UA blocking", () => {
  let middleware: (req: NextRequest) => Response | ReturnType<typeof import("next/server")["NextResponse"]["next"]>;

  beforeEach(async () => {
    vi.resetModules();
    process.env.SESSION_TOKEN = "valid-token";
    process.env.ALLOWED_ORIGINS = "";
    const mod = await import("@/middleware");
    middleware = mod.middleware;
  });

  const BOT_UAS = [
    "curl/7.64.1",
    "Wget/1.20.3",
    "python-requests/2.28.0",
    "Scrapy/2.6.0",
    "HTTrack/3.49-2",
    "libwww-perl/6.05",
    "Go-http-client/1.1",
    "Java/11.0.0",
  ];

  for (const ua of BOT_UAS) {
    it(`blocks bot UA: ${ua}`, async () => {
      const req = makeReq("/api/research", { ua, session: "valid-token" });
      const res = await middleware(req);
      expect(res.status).toBe(403);
    });
  }

  it("allows a legitimate browser UA", async () => {
    const req = makeReq("/login", { ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" });
    const res = await middleware(req);
    // /login is passed through
    expect(res.status).not.toBe(403);
  });

  it("blocks empty user-agent", async () => {
    const req = makeReq("/api/research", { ua: "", session: "valid-token" });
    const res = await middleware(req);
    expect(res.status).toBe(403);
  });
});

describe("middleware — session authentication", () => {
  let middleware: (req: NextRequest) => Response | ReturnType<typeof import("next/server")["NextResponse"]["next"]>;

  beforeEach(async () => {
    vi.resetModules();
    process.env.SESSION_TOKEN = "secret-abc";
    process.env.ALLOWED_ORIGINS = "";
    const mod = await import("@/middleware");
    middleware = mod.middleware;
  });

  it("returns 401 on API routes when session token is missing", async () => {
    const req = makeReq("/api/research");
    const res = await middleware(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 on API routes when session token is wrong", async () => {
    const req = makeReq("/api/research", { session: "wrong-token" });
    const res = await middleware(req);
    expect(res.status).toBe(401);
  });

  it("redirects to /login for page routes with no session", async () => {
    const req = makeReq("/planner");
    const res = await middleware(req);
    // Redirect (3xx) to /login
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
  });

  it("allows /login page without session", async () => {
    const req = makeReq("/login");
    const res = await middleware(req);
    // Should not redirect (passes through)
    expect(res.status).not.toBeGreaterThanOrEqual(400);
  });

  it("allows /api/auth/login without session", async () => {
    const req = makeReq("/api/auth/login", { method: "POST" });
    const res = await middleware(req);
    // Login endpoint always passes through (rate limited separately)
    expect(res.status).not.toBe(401);
  });
});

describe("middleware — login rate limiting", () => {
  beforeEach(async () => {
    vi.resetModules();
    process.env.SESSION_TOKEN = "";
    process.env.ALLOWED_ORIGINS = "";
  });

  it("blocks the 6th login attempt from the same IP within 60s", async () => {
    const mod = await import("@/middleware");
    const mw = mod.middleware;

    const makeLoginReq = (ip: string) =>
      makeReq("/api/auth/login", { method: "POST", ua: "Mozilla/5.0", ip });

    const ip = `10.0.0.${Math.floor(Math.random() * 254) + 1}`;

    // 5 allowed attempts
    for (let i = 0; i < 5; i++) {
      const res = await mw(makeLoginReq(ip));
      expect(res.status).not.toBe(429);
    }

    // 6th should be rate limited
    const res = await mw(makeLoginReq(ip));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
  });
});

describe("middleware — CORS", () => {
  let middleware: (req: NextRequest) => Response | ReturnType<typeof import("next/server")["NextResponse"]["next"]>;

  beforeEach(async () => {
    vi.resetModules();
    process.env.SESSION_TOKEN = "valid-token";
    process.env.ALLOWED_ORIGINS = "https://myapp.com";
    const mod = await import("@/middleware");
    middleware = mod.middleware;
  });

  afterEach(() => {
    process.env.ALLOWED_ORIGINS = "";
  });

  it("blocks API request from unlisted origin", async () => {
    const req = makeReq("/api/research", {
      origin: "https://evil.com",
      session: "valid-token",
    });
    const res = await middleware(req);
    expect(res.status).toBe(403);
  });

  it("allows API request from listed origin", async () => {
    const req = makeReq("/api/research", {
      origin: "https://myapp.com",
      session: "valid-token",
    });
    const res = await middleware(req);
    expect(res.status).not.toBe(403);
  });

  it("returns 204 for OPTIONS preflight from listed origin", async () => {
    const req = makeReq("/api/research", {
      method: "OPTIONS",
      origin: "https://myapp.com",
    });
    const res = await middleware(req);
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://myapp.com");
  });

  it("returns 204 with no CORS headers for OPTIONS from unlisted origin", async () => {
    const req = makeReq("/api/research", {
      method: "OPTIONS",
      origin: "https://evil.com",
    });
    const res = await middleware(req);
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
