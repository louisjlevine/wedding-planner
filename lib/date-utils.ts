import type { WeddingAnswers } from "./types";

// Wedding dates are stored as plain "YYYY-MM-DD" strings. `new Date("2027-07-15")`
// parses that as UTC midnight, so `toLocaleDateString` renders the day before for
// anyone west of Greenwich. Every display path goes through the helpers here so a
// date the user picked is the date the user sees.

export type Season = "Spring" | "Summer" | "Autumn" | "Winter";

export const SEASONS: { value: Season; desc: string }[] = [
  { value: "Spring", desc: "Mar – May" },
  { value: "Summer", desc: "Jun – Aug" },
  { value: "Autumn", desc: "Sep – Nov" },
  { value: "Winter", desc: "Dec – Feb" },
];

const SEASON_MONTH: Record<Season, string> = {
  Spring: "05",
  Summer: "07",
  Autumn: "10",
  Winter: "12",
};

/** Representative ISO date for a season + year — the middle of the middle month. */
export function seasonToDate(season: Season, year: number): string {
  return `${year}-${SEASON_MONTH[season]}-15`;
}

export function monthToSeason(month: number): Season {
  // month is 1-12
  if (month <= 2 || month === 12) return "Winter";
  if (month <= 5) return "Spring";
  if (month <= 8) return "Summer";
  return "Autumn";
}

export function dateToSeason(iso: string): { season: Season; year: number } {
  const d = parseISODate(iso) ?? new Date();
  return { season: monthToSeason(d.getMonth() + 1), year: d.getFullYear() };
}

/** Parses "YYYY-MM-DD" at *local* midnight. Returns null for anything unparseable. */
export function parseISODate(iso: string | undefined | null): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) {
    const fallback = new Date(iso);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Formats a Date as "YYYY-MM-DD" using its *local* calendar fields. */
export function toISODate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today as "YYYY-MM-DD" in the viewer's own timezone. */
export function todayISO(now: number = Date.now()): string {
  return toISODate(new Date(now));
}

export function formatDate(
  iso: string | undefined | null,
  opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" },
): string {
  const d = parseISODate(iso);
  return d ? d.toLocaleDateString("en-US", opts) : "";
}

export function formatDateLong(iso: string | undefined | null): string {
  return formatDate(iso, { month: "long", day: "numeric", year: "numeric" });
}

export function formatMonthYear(iso: string | undefined | null): string {
  return formatDate(iso, { month: "short", year: "numeric" });
}

/** Whole days from today (local) to `iso`. Negative once the date has passed. */
export function daysUntil(iso: string | undefined | null, now: number = Date.now()): number | null {
  const target = parseISODate(iso);
  if (!target) return null;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

// ── Exact vs. approximate ─────────────────────────────────────────────────────

/** True when the couple has locked in a specific day rather than a season + year. */
export function hasExactDate(answers: Pick<WeddingAnswers, "dateIsExact">): boolean {
  return answers.dateIsExact === true;
}

/**
 * Human label for the wedding date. Exact dates render in full; approximate ones
 * render as the season + year they were chosen from, so nothing in the UI (or in
 * an AI prompt) implies more precision than the couple actually has.
 */
export function describeWeddingDate(
  answers: Pick<WeddingAnswers, "date" | "dateIsExact">,
  opts: { style?: "long" | "short" } = {},
): string {
  if (!answers.date) return "Date not set";
  if (hasExactDate(answers)) {
    return opts.style === "short" ? formatDate(answers.date) : formatDateLong(answers.date);
  }
  const { season, year } = dateToSeason(answers.date);
  return `${season} ${year}`;
}

/** Same as `describeWeddingDate`, with an explicit note when the date is a placeholder. */
export function describeWeddingDateForPrompt(
  answers: Pick<WeddingAnswers, "date" | "dateIsExact">,
): string {
  if (!answers.date) return "not set yet";
  if (hasExactDate(answers)) return `${formatDateLong(answers.date)} (${answers.date}, confirmed)`;
  const { season, year } = dateToSeason(answers.date);
  return `${season} ${year} (approximate — exact day not chosen yet; ${answers.date} is a placeholder)`;
}
