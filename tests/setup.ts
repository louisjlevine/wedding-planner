// Global test setup — runs before every test file
import { vi } from "vitest";

// Suppress console.error output from routes during tests to keep output clean
vi.spyOn(console, "error").mockImplementation(() => {});
