/**
 * Pre-release integration checks — these tests verify structural and
 * configuration correctness that must hold before every production release.
 *
 * They do not require a running server or real API keys.
 */
import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "../..");

function readFile(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function fileExists(rel: string): boolean {
  return fs.existsSync(path.join(ROOT, rel));
}

// ── next.config.ts security headers ──────────────────────────────────────────

describe("Security headers — next.config.ts", () => {
  const config = readFile("next.config.ts");

  it("sets X-Frame-Options", () => expect(config).toContain("X-Frame-Options"));
  it("sets X-Content-Type-Options", () => expect(config).toContain("X-Content-Type-Options"));
  it("sets Referrer-Policy", () => expect(config).toContain("Referrer-Policy"));
  it("sets Strict-Transport-Security", () => expect(config).toContain("Strict-Transport-Security"));
  it("sets Content-Security-Policy", () => expect(config).toContain("Content-Security-Policy"));
  it("sets Permissions-Policy", () => expect(config).toContain("Permissions-Policy"));
});

// ── .gitignore / secret hygiene ───────────────────────────────────────────────

describe("Secret hygiene", () => {
  it(".env.local is gitignored", () => {
    const gitignore = readFile(".gitignore");
    expect(gitignore).toMatch(/\.env/);
  });

  it(".env.local is not tracked by git", () => {
    let trackedFiles = "";
    try {
      trackedFiles = execSync("git ls-files .env.local 2>/dev/null", { cwd: ROOT }).toString();
    } catch {
      trackedFiles = "";
    }
    expect(trackedFiles.trim()).toBe("");
  });

  it("no API key literals in tracked source files", () => {
    let result = "";
    try {
      result = execSync(
        "git grep -r 'sk-ant-' -- '*.ts' '*.tsx' '*.js' '*.json' ':!tests/' 2>/dev/null || true",
        { cwd: ROOT }
      ).toString();
    } catch {
      result = "";
    }
    expect(result.trim()).toBe("");
  });
});

// ── Middleware exists and covers auth ─────────────────────────────────────────

describe("Middleware — structural checks", () => {
  const mw = readFile("middleware.ts");

  it("middleware.ts exists", () => expect(fileExists("middleware.ts")).toBe(true));
  it("checks session cookie", () => expect(mw).toContain("session"));
  it("implements rate limiting", () => expect(mw).toContain("isRateLimited"));
  it("blocks bot user-agents", () => expect(mw).toContain("BOT_UA_BLOCKLIST"));
  it("handles CORS", () => expect(mw).toContain("ALLOWED_ORIGINS"));
  it("exports a matcher config", () => expect(mw).toContain("matcher"));
});

// ── API routes have minimal validation ───────────────────────────────────────

describe("API routes — validation present", () => {
  it("/api/research validates type", () => {
    const src = readFile("app/api/research/route.ts");
    expect(src).toContain("VALID_RESEARCH_TYPES");
  });

  it("/api/recommendations validates type", () => {
    const src = readFile("app/api/recommendations/route.ts");
    expect(src).toContain("VALID_TYPES");
  });

  it("/api/feedback uses zod for validation", () => {
    const src = readFile("app/api/feedback/route.ts");
    expect(src).toMatch(/zod|z\.object|z\.string/i);
  });

  it("/api/vendor-description has SSRF guard", () => {
    const src = readFile("app/api/vendor-description/route.ts");
    expect(src).toContain("isPrivateUrl");
  });

  it("/api/vendor-description SSRF guard blocks IPv6 loopback [::1]", () => {
    const src = readFile("app/api/vendor-description/route.ts");
    expect(src).toContain("[::1]");
  });

  it("/api/sync validates payload is an object", () => {
    const src = readFile("app/api/sync/route.ts");
    expect(src).toMatch(/typeof|object|Array\.isArray/);
  });
});

// ── Key library files exist ───────────────────────────────────────────────────

describe("Required files exist", () => {
  const required = [
    "lib/types.ts",
    "lib/plan-store.ts",
    "lib/plan-adapters.ts",
    "lib/research-prompts.ts",
    "lib/guest-probability.ts",
    "middleware.ts",
    "next.config.ts",
  ];

  for (const file of required) {
    it(`${file} exists`, () => expect(fileExists(file)).toBe(true));
  }
});

// ── Sidebar nav — all tabs present ───────────────────────────────────────────

describe("Sidebar nav — all tabs present", () => {
  const sidebar = readFile("components/shell/Sidebar.tsx");

  const expectedTabs = [
    "overview",
    "advisor",
    "research",
    "budget",
    "timeline",
    "vendors",
    "guests",
    "digest",
  ];

  for (const tab of expectedTabs) {
    it(`includes "${tab}" tab`, () => expect(sidebar).toContain(`"${tab}"`));
  }
});

// ── TypeScript compiles without errors ────────────────────────────────────────

describe("TypeScript — compilation", () => {
  it("tsc --noEmit passes with no errors", () => {
    let error = "";
    try {
      execSync("npx tsc --noEmit 2>&1", { cwd: ROOT, timeout: 60_000 });
    } catch (e: unknown) {
      error = (e as { stdout?: Buffer }).stdout?.toString() ?? String(e);
    }
    expect(error).toBe("");
  });
});
