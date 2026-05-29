import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Button, IconButton } from "@/components/ui/Button";
import { Markdown, TypingDots } from "@/components/ui/Markdown";

// These primitives are now load-bearing across multiple sections (Button in
// DigestSettings, IconButton in the Topbar, Markdown/TypingDots in every AI
// surface). The suite runs in a node environment with no DOM, so we assert on
// the server-rendered markup instead of mounting — no jsdom dependency needed.

describe("Button", () => {
  it("renders its children", () => {
    expect(renderToStaticMarkup(<Button>Save</Button>)).toContain("Save");
  });

  it("uses the accent fill for the default (primary) variant", () => {
    expect(renderToStaticMarkup(<Button>Go</Button>)).toContain("bg-[var(--accent)]");
  });

  it("renders the secondary variant as a neutral outline", () => {
    const html = renderToStaticMarkup(<Button variant="secondary">Preview</Button>);
    expect(html).toContain("border-gray-200");
    expect(html).not.toContain("bg-[var(--accent)]");
  });

  it("forwards the disabled attribute", () => {
    expect(renderToStaticMarkup(<Button disabled>X</Button>)).toContain("disabled");
  });
});

describe("IconButton", () => {
  it("applies the label as both accessible name and tooltip", () => {
    const html = renderToStaticMarkup(
      <IconButton label="Sign out">
        <svg />
      </IconButton>,
    );
    expect(html).toContain('aria-label="Sign out"');
    expect(html).toContain('title="Sign out"');
  });

  it("enforces the 44px minimum tap target", () => {
    const html = renderToStaticMarkup(
      <IconButton label="Export">
        <svg />
      </IconButton>,
    );
    expect(html).toContain("min-w-[44px]");
    expect(html).toContain("min-h-[44px]");
  });
});

describe("Markdown", () => {
  it("renders bold text via the strong mapping", () => {
    const html = renderToStaticMarkup(<Markdown>{"**hi**"}</Markdown>);
    expect(html).toContain("<strong");
    expect(html).toContain("hi");
  });

  it("opens links in a new tab with safe rel", () => {
    const html = renderToStaticMarkup(<Markdown>{"[x](https://example.com)"}</Markdown>);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("renders GFM tables (remark-gfm wired up)", () => {
    const md = "| a | b |\n| - | - |\n| 1 | 2 |";
    expect(renderToStaticMarkup(<Markdown>{md}</Markdown>)).toContain("<table");
  });
});

describe("TypingDots", () => {
  it("renders exactly three animated dots", () => {
    const html = renderToStaticMarkup(<TypingDots />);
    expect((html.match(/animate-bounce/g) ?? []).length).toBe(3);
  });

  it("uses Tailwind arbitrary delays, not inline styles", () => {
    const html = renderToStaticMarkup(<TypingDots />);
    expect(html).toContain("[animation-delay:0.1s]");
    expect(html).not.toContain("style=");
  });
});
