import type { NextConfig } from "next";
import path from "path";
import fs from "fs";

// Workaround: when a lockfile exists in a parent directory, Turbopack's
// workspace-root detection can prevent .env.local from being injected into
// process.env for server routes. Read the file explicitly here so API routes
// always have access to server-only env vars like ANTHROPIC_API_KEY.
try {
  const envPath = path.resolve(__dirname, ".env.local");
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  }
} catch {
  // .env.local not present — env vars must come from the shell
}

const nextConfig: NextConfig = {};

export default nextConfig;
