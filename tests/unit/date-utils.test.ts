import { describe, it, expect } from "vitest";
import {
  parseISODate,
  toISODate,
  todayISO,
  formatDate,
  formatDateLong,
  formatMonthYear,
  daysUntil,
  seasonToDate,
  dateToSeason,
  monthToSeason,
  describeWeddingDate,
  describeWeddingDateForPrompt,
  hasExactDate,
} from "@/lib/date-utils";
import type { WeddingAnswers } from "@/lib/types";

const answers = (overrides: Partial<WeddingAnswers> = {}): WeddingAnswers =>
  ({
    partnerName: "Alex",
    date: "2027-07-15",
    location: "Nashville, TN",
    guestCount: 100,
    budget: 50_000,
    vibe: ["romantic"],
    priorities: ["venue", "food", "photography"],
    setting: "indoor",
    funding: "self",
    stress: ["budget"],
    ...overrides,
  }) as WeddingAnswers;

describe("parseISODate", () => {
  it("parses YYYY-MM-DD at local midnight, not UTC", () => {
    const d = parseISODate("2027-07-15")!;
    expect(d.getFullYear()).toBe(2027);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(0);
  });

  it("ignores a time component and keeps the calendar day", () => {
    const d = parseISODate("2027-07-15T23:30:00Z")!;
    expect(d.getDate()).toBe(15);
  });

  it("returns null for empty or unparseable input", () => {
    expect(parseISODate("")).toBeNull();
    expect(parseISODate(undefined)).toBeNull();
    expect(parseISODate("not a date")).toBeNull();
  });
});

describe("toISODate / todayISO", () => {
  it("round-trips a local date", () => {
    expect(toISODate(new Date(2027, 0, 5))).toBe("2027-01-05");
  });

  it("uses the local calendar day for todayISO", () => {
    const noon = new Date(2026, 2, 9, 12, 0, 0).getTime();
    expect(todayISO(noon)).toBe("2026-03-09");
  });
});

describe("formatting", () => {
  it("renders the day the user picked, not the UTC-shifted one", () => {
    expect(formatDate("2027-07-15")).toBe("Jul 15, 2027");
    expect(formatDateLong("2027-07-15")).toBe("July 15, 2027");
    expect(formatMonthYear("2027-07-15")).toBe("Jul 2027");
  });

  it("returns an empty string for a missing date", () => {
    expect(formatDate("")).toBe("");
    expect(formatDateLong(undefined)).toBe("");
  });
});

describe("daysUntil", () => {
  const now = new Date(2027, 6, 1, 9, 30).getTime();

  it("counts whole days ahead regardless of the time of day", () => {
    expect(daysUntil("2027-07-15", now)).toBe(14);
  });

  it("returns 0 on the day itself", () => {
    expect(daysUntil("2027-07-01", now)).toBe(0);
  });

  it("goes negative once the date has passed", () => {
    expect(daysUntil("2027-06-28", now)).toBe(-3);
  });

  it("returns null without a date", () => {
    expect(daysUntil(undefined, now)).toBeNull();
  });
});

describe("season helpers", () => {
  it("maps a season + year to the middle of the middle month", () => {
    expect(seasonToDate("Summer", 2027)).toBe("2027-07-15");
    expect(seasonToDate("Winter", 2027)).toBe("2027-12-15");
  });

  it("maps months back to seasons, wrapping December into Winter", () => {
    expect(monthToSeason(12)).toBe("Winter");
    expect(monthToSeason(1)).toBe("Winter");
    expect(monthToSeason(4)).toBe("Spring");
    expect(monthToSeason(7)).toBe("Summer");
    expect(monthToSeason(10)).toBe("Autumn");
  });

  it("round-trips through dateToSeason", () => {
    expect(dateToSeason(seasonToDate("Autumn", 2028))).toEqual({ season: "Autumn", year: 2028 });
  });
});

describe("describeWeddingDate", () => {
  it("shows the full date once the couple has confirmed one", () => {
    expect(describeWeddingDate(answers({ date: "2027-09-04", dateIsExact: true }))).toBe(
      "September 4, 2027",
    );
  });

  it("shows season + year while the date is still approximate", () => {
    expect(describeWeddingDate(answers({ dateIsExact: false }))).toBe("Summer 2027");
  });

  it("treats a missing flag as approximate", () => {
    expect(describeWeddingDate(answers())).toBe("Summer 2027");
  });

  it("handles a plan with no date at all", () => {
    expect(describeWeddingDate(answers({ date: "" }))).toBe("Date not set");
  });

  it("supports a short style for exact dates", () => {
    expect(
      describeWeddingDate(answers({ date: "2027-09-04", dateIsExact: true }), { style: "short" }),
    ).toBe("Sep 4, 2027");
  });
});

describe("describeWeddingDateForPrompt", () => {
  it("marks a confirmed date as confirmed and includes the ISO value", () => {
    const text = describeWeddingDateForPrompt(answers({ date: "2027-09-04", dateIsExact: true }));
    expect(text).toContain("September 4, 2027");
    expect(text).toContain("2027-09-04");
    expect(text).toContain("confirmed");
  });

  it("tells the model an approximate date is a placeholder", () => {
    const text = describeWeddingDateForPrompt(answers({ dateIsExact: false }));
    expect(text).toContain("Summer 2027");
    expect(text).toMatch(/approximate/i);
    expect(text).toMatch(/placeholder/i);
  });

  it("says so when no date is set", () => {
    expect(describeWeddingDateForPrompt(answers({ date: "" }))).toBe("not set yet");
  });
});

describe("hasExactDate", () => {
  it("is true only for an explicit flag", () => {
    expect(hasExactDate({ dateIsExact: true })).toBe(true);
    expect(hasExactDate({ dateIsExact: false })).toBe(false);
    expect(hasExactDate({})).toBe(false);
  });
});
