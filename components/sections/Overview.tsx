"use client";

import { useState } from "react";
import { usePlan } from "@/hooks/usePlan";
import { usePlanStore } from "@/lib/plan-store";
import { MetricCard } from "@/components/ui/MetricCard";
import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import type { WeddingPriority } from "@/lib/types";

// ── Season helpers (mirrors Intake.tsx) ───────────────────────────────────────

type Season = "Spring" | "Summer" | "Autumn" | "Winter";
const SEASONS: { value: Season; desc: string }[] = [
  { value: "Spring", desc: "Mar–May" },
  { value: "Summer", desc: "Jun–Aug" },
  { value: "Autumn", desc: "Sep–Nov" },
  { value: "Winter", desc: "Dec–Feb" },
];

function seasonToDate(season: Season, year: number): string {
  const month = { Spring: "05", Summer: "07", Autumn: "10", Winter: "12" }[season];
  return `${year}-${month}-15`;
}

function dateToSeason(iso: string): { season: Season; year: number } {
  const d = new Date(iso);
  const m = d.getMonth() + 1;
  const year = d.getFullYear();
  const season: Season = m <= 2 || m === 12 ? "Winter" : m <= 5 ? "Spring" : m <= 8 ? "Summer" : "Autumn";
  return { season, year };
}

const PRIORITIES: { value: WeddingPriority; label: string }[] = [
  { value: "photography",     label: "Photography" },
  { value: "food",            label: "Food & Drink" },
  { value: "music",           label: "Music" },
  { value: "flowers",         label: "Flowers & Decor" },
  { value: "venue",           label: "Venue" },
  { value: "honeymoon",       label: "Honeymoon" },
  { value: "dress",           label: "Attire" },
  { value: "guest_experience",label: "Guest Experience" },
];

// ── Edit wedding details panel ─────────────────────────────────────────────────

function EditDetailsPanel({ onClose }: { onClose: () => void }) {
  const { answers, updateAnswers } = usePlanStore();
  if (!answers) return null;

  const { season: initSeason, year: initYear } = dateToSeason(answers.date ?? "");
  const [season, setSeason]       = useState<Season>(initSeason);
  const [year, setYear]           = useState(initYear);
  const [guestCount, setGuestCount] = useState((answers.guestCount ?? 100).toString());
  const [priorities, setPriorities] = useState<WeddingPriority[]>([...(answers.priorities ?? [])]);

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear + i);

  function togglePriority(p: WeddingPriority) {
    setPriorities((prev) =>
      prev.includes(p)
        ? prev.filter((x) => x !== p)
        : prev.length < 3 ? [...prev, p] : prev
    );
  }

  function save() {
    const count = parseInt(guestCount) || answers!.guestCount;
    updateAnswers({
      date:       seasonToDate(season, year),
      guestCount: count,
      priorities: priorities.length === 3 ? priorities : answers!.priorities,
    });
    onClose();
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
      <h3 className="text-sm font-semibold text-gray-700">Edit wedding details</h3>

      {/* Season + year */}
      <div>
        <label className="text-xs text-gray-500 mb-2 block font-medium">Wedding date</label>
        <div className="flex gap-2 flex-wrap">
          {SEASONS.map(({ value, desc }) => (
            <button key={value} onClick={() => setSeason(value)}
              className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                season === value
                  ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] font-medium"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              }`}>
              {value} <span className="text-xs opacity-60 ml-1">{desc}</span>
            </button>
          ))}
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]">
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Guest count */}
      <div>
        <label className="text-xs text-gray-500 mb-2 block font-medium">Guest estimate</label>
        <input
          type="number"
          value={guestCount}
          onChange={(e) => setGuestCount(e.target.value)}
          min="1"
          className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
        />
        <p className="text-xs text-gray-400 mt-1">Updates timeline, budget categories, and adaptive rules</p>
      </div>

      {/* Priorities */}
      <div>
        <label className="text-xs text-gray-500 mb-2 block font-medium">
          Top 3 priorities
          {priorities.length < 3 && (
            <span className="text-amber-500 ml-2">pick {3 - priorities.length} more</span>
          )}
        </label>
        <div className="flex flex-wrap gap-2">
          {PRIORITIES.map(({ value, label }) => {
            const selected = priorities.includes(value);
            const disabled = !selected && priorities.length >= 3;
            return (
              <button key={value} onClick={() => togglePriority(value)} disabled={disabled}
                className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                  selected
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] font-medium"
                    : disabled
                    ? "border-gray-100 text-gray-300 cursor-not-allowed"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}>
                {label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-gray-400 mt-1">Changing priorities adjusts budget allocations (photography/food get +5% each)</p>
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={save}
          className="px-4 py-2 bg-[var(--accent)] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-colors">
          Save changes
        </button>
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Overview page ─────────────────────────────────────────────────────────────

export function Overview() {
  const { answers, tasks, guests, vendors, timeline, budgetCategories, setActiveTab } = usePlan();
  const [editingDetails, setEditingDetails] = useState(false);

  if (!answers) return null;

  const totalBudget  = answers.budget;
  const totalSpent   = budgetCategories.reduce((sum, c) => sum + c.spent, 0);
  const remaining    = totalBudget - totalSpent;
  const doneTasks    = tasks.filter((t) => t.done).length;
  const totalTasks   = tasks.length;
  const confirmedGuests = guests.filter((g) => g.rsvp === "yes").length;
  const bookedVendors   = vendors.filter((v) => v.status === "booked").length;
  const daysUntil = Math.ceil(
    (new Date(answers.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  const nextItems = timeline
    .filter((t) => !t.done && t.targetDate >= new Date().toISOString().split("T")[0])
    .slice(0, 4);
  const flags = [
    ...timeline.filter((t) => t.flag),
    ...tasks.filter((t) => t.flag),
  ].slice(0, 4);

  const weddingDate = new Date(answers.date).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)] mb-1">Overview</p>
          <h1 className="text-2xl font-bold text-gray-900">
            Louis &amp; {answers.partnerName}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {answers.location} &middot; {weddingDate} &middot; {answers.guestCount} guests
          </p>
        </div>
        <button
          onClick={() => setEditingDetails((v) => !v)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors shrink-0 mt-1"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          {editingDetails ? "Close" : "Edit details"}
        </button>
      </div>

      {/* Editable details panel */}
      {editingDetails && <EditDetailsPanel onClose={() => setEditingDetails(false)} />}

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Days to go"
          value={daysUntil > 0 ? daysUntil.toLocaleString() : "Today!"}
          sub={new Date(answers.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        />
        <MetricCard
          label="Budget remaining"
          value={`$${remaining.toLocaleString()}`}
          sub={`of $${totalBudget.toLocaleString()} total`}
        />
        <MetricCard
          label="Tasks done"
          value={totalTasks === 0 ? "—" : `${doneTasks} / ${totalTasks}`}
          sub={totalTasks === 0 ? "No tasks yet" : `${totalTasks - doneTasks} remaining`}
        />
        <MetricCard
          label="Guests confirmed"
          value={confirmedGuests > 0 ? confirmedGuests : "—"}
          sub={bookedVendors > 0 ? `${bookedVendors} vendors booked` : "No vendors booked yet"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel
          title="Coming up"
          action={
            <button onClick={() => setActiveTab("timeline")}
              className="text-xs text-[var(--accent)] hover:underline">
              View all
            </button>
          }
        >
          {nextItems.length > 0 ? (
            <ul className="space-y-3">
              {nextItems.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{item.title}</p>
                    {item.flag && <p className="text-xs text-[var(--accent)] mt-0.5">{item.flag}</p>}
                  </div>
                  <span className="text-xs text-gray-400 shrink-0 mt-0.5">
                    {item.targetDate
                      ? new Date(item.targetDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">No upcoming items.</p>
          )}
        </Panel>

        <Panel
          title="Things to note"
          action={flags.length > 0 ? <Badge variant="pink">{flags.length} flags</Badge> : null}
        >
          {flags.length > 0 ? (
            <ul className="space-y-3">
              {flags.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] mt-1.5 shrink-0" />
                  <p className="text-sm text-gray-700">{"flag" in item ? item.flag : ""}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">No flags for your wedding details.</p>
          )}
        </Panel>
      </div>

      <Panel
        title="Your priorities"
        action={
          <div className="flex gap-1.5">
            {answers.vibe.slice(0, 3).map((v) => (
              <Badge key={v} variant="gray">{v}</Badge>
            ))}
          </div>
        }
      >
        <div className="flex flex-wrap gap-2">
          {answers.priorities.map((p) => (
            <Badge key={p} variant="pink">{p.replace("_", " ")}</Badge>
          ))}
        </div>
      </Panel>
    </div>
  );
}
