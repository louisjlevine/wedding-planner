"use client";

import { useMemo } from "react";
import { usePlanStore } from "@/lib/plan-store";
import { Panel } from "@/components/ui/Panel";
import type { Vendor, BarMode } from "@/lib/types";
import { computeScenario, type BarAddon } from "@/lib/compare-cost";

const STATUS_DOT: Record<Vendor["status"], string> = {
  considering: "bg-gray-400",
  contacted:   "bg-yellow-400",
  booked:      "bg-green-500",
  rejected:    "bg-red-400",
};

function fmtMoney(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtSigned(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "$0";
  const sign = n < 0 ? "−" : "+";
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString()}`;
}

// ── Chip selector for one category ───────────────────────────────────────────

function CategoryPicker({
  label,
  vendors,
  selectedIds,
  onToggle,
}: {
  label: string;
  vendors: Vendor[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        {label} <span className="text-gray-400 font-normal normal-case">({vendors.length})</span>
      </p>
      {vendors.length === 0 ? (
        <p className="text-xs text-gray-400 italic">
          No {label.toLowerCase()} vendors yet — add them on the Vendors tab.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {vendors.map((v) => {
            const active = selectedIds.includes(v.id);
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => onToggle(v.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  active
                    ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                    : "bg-white text-gray-700 border-gray-200 hover:border-[var(--accent)]/50"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-white/80" : STATUS_DOT[v.status]}`} />
                {v.name?.trim() || "Untitled"}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

type Scenario = ReturnType<typeof computeScenario>;

function MoneyCell({ value, faded }: { value: number; faded?: boolean }) {
  return (
    <td className={`px-3 py-2 text-right tabular-nums ${faded ? "text-gray-400" : "text-gray-700"}`}>
      {fmtMoney(value)}
    </td>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export function Compare() {
  const { vendors, answers, comparison, updateComparison } = usePlanStore();

  // Rejected vendors don't belong in cost comparison.
  const venueOptions    = vendors.filter((v) => v.category === "Venue"    && v.status !== "rejected");
  const cateringOptions = vendors.filter((v) => v.category === "Catering" && v.status !== "rejected");

  function toggle(list: "venueIds" | "cateringIds", id: string) {
    const current = comparison[list];
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : [...current, id];
    updateComparison({ [list]: next });
  }

  const guestCount = comparison.guestCount ?? answers?.guestCount ?? 100;
  const hours      = comparison.hours ?? 8;
  const barMode: BarMode = comparison.barMode ?? "self_host";
  const barFlat = comparison.barFlatBudget;
  const barPerPerson = comparison.barPerPerson;

  const venueSel    = venueOptions.filter((v) => comparison.venueIds.includes(v.id));
  const cateringSel = cateringOptions.filter((v) => comparison.cateringIds.includes(v.id));

  type Column = {
    key: string;
    venue?: Vendor;
    catering?: Vendor;
    scenario: Scenario;
  };

  const columns: Column[] = useMemo(() => {
    const barAddon: BarAddon = { mode: barMode, flatBudget: barFlat, perPerson: barPerPerson };
    const venues = venueSel.length ? venueSel : [undefined];
    const caterings = cateringSel.length ? cateringSel : [undefined];
    const out: Column[] = [];
    for (const v of venues) {
      for (const c of caterings) {
        out.push({
          key: `${v?.id ?? "–"}|${c?.id ?? "–"}`,
          venue: v,
          catering: c,
          scenario: computeScenario(v, c, barAddon, guestCount, hours),
        });
      }
    }
    return out.slice(0, 8);
  }, [venueSel, cateringSel, barMode, barFlat, barPerPerson, guestCount, hours]);

  const budget = answers?.budget ?? 0;
  const anySelected = venueSel.length + cateringSel.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Compare</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Side-by-side cost for venues, catering, and bar. Edit cost details on each vendor in the Vendors tab.
        </p>
      </div>

      {/* 1 — Pickers */}
      <Panel title="Choose what to compare">
        <div className="space-y-4">
          <CategoryPicker
            label="Venue"
            vendors={venueOptions}
            selectedIds={comparison.venueIds}
            onToggle={(id) => toggle("venueIds", id)}
          />
          <CategoryPicker
            label="Catering"
            vendors={cateringOptions}
            selectedIds={comparison.cateringIds}
            onToggle={(id) => toggle("cateringIds", id)}
          />
        </div>
      </Panel>

      {/* Inputs that drive the math */}
      <Panel title="Event assumptions">
        <div className="space-y-4 max-w-xl">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Guest count</label>
              <input
                type="number"
                value={comparison.guestCount ?? answers?.guestCount ?? ""}
                placeholder={(answers?.guestCount ?? 100).toString()}
                onChange={(e) => {
                  const n = parseInt(e.target.value);
                  updateComparison({ guestCount: Number.isFinite(n) ? n : undefined });
                }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
              />
              <p className="text-[11px] text-gray-400 mt-1">Drives catering & per-person bar totals.</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Event hours</label>
              <input
                type="number"
                value={comparison.hours ?? 8}
                onChange={(e) => {
                  const n = parseInt(e.target.value);
                  updateComparison({ hours: Number.isFinite(n) ? n : undefined });
                }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
              />
              <p className="text-[11px] text-gray-400 mt-1">Hours past venue&apos;s included time = overtime.</p>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Bar handling</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {([
                { id: "self_host",  label: "Self-host" },
                { id: "via_caterer", label: "Through caterer" },
              ] as const).map((opt) => {
                const active = barMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updateComparison({ barMode: opt.id })}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                      active
                        ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                        : "bg-white text-gray-700 border-gray-200 hover:border-[var(--accent)]/50"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {barMode === "self_host" ? (
              <div className="max-w-xs">
                <label className="text-xs text-gray-500 mb-1 block">Total alcohol budget ($)</label>
                <input
                  type="number"
                  value={comparison.barFlatBudget ?? ""}
                  placeholder="e.g. 2500"
                  onChange={(e) => {
                    const n = parseFloat(e.target.value);
                    updateComparison({ barFlatBudget: Number.isFinite(n) ? n : undefined });
                  }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
                />
                <p className="text-[11px] text-gray-400 mt-1">Flat amount for booze + ice + bartender if any.</p>
              </div>
            ) : (
              <div className="max-w-xs">
                <label className="text-xs text-gray-500 mb-1 block">$ / person added by caterer</label>
                <input
                  type="number"
                  value={comparison.barPerPerson ?? ""}
                  placeholder="e.g. 25"
                  onChange={(e) => {
                    const n = parseFloat(e.target.value);
                    updateComparison({ barPerPerson: Number.isFinite(n) ? n : undefined });
                  }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
                />
                <p className="text-[11px] text-gray-400 mt-1">Multiplied by guest count.</p>
              </div>
            )}
          </div>
        </div>
      </Panel>

      {/* 2 — Side-by-side table */}
      <Panel title="Side-by-side cost">
        {!anySelected ? (
          <p className="text-sm text-gray-400 italic">
            Pick at least one vendor above to see the cost breakdown.
          </p>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-xs border border-gray-200 rounded-xl overflow-hidden">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-3 py-2 font-medium text-gray-500 w-44">Line item</th>
                  {columns.map((col, i) => (
                    <th key={col.key} className="px-3 py-2 font-medium text-gray-700 text-right whitespace-nowrap">
                      Option {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* VENUE GROUP */}
                <tr className="bg-gray-50/60">
                  <td colSpan={columns.length + 1} className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                    Venue
                  </td>
                </tr>
                <tr className="border-t border-gray-100">
                  <td className="px-3 py-2 text-gray-500">Vendor</td>
                  {columns.map((col) => (
                    <td key={col.key} className="px-3 py-2 text-right font-medium text-gray-900 whitespace-nowrap">
                      {col.venue?.name ?? "—"}
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-gray-100">
                  <td className="px-3 py-2 text-gray-500">Base cost</td>
                  {columns.map((col) => (
                    <MoneyCell key={col.key} value={col.scenario.venue.base} />
                  ))}
                </tr>
                <tr className="border-t border-gray-100">
                  <td className="px-3 py-2 text-gray-500">Hours included</td>
                  {columns.map((col) => (
                    <td key={col.key} className="px-3 py-2 text-right text-gray-700 tabular-nums">
                      {col.venue?.costModel?.hoursIncluded ?? "—"}
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-gray-100">
                  <td className="px-3 py-2 text-gray-500">Overtime ({hours}h event)</td>
                  {columns.map((col) => (
                    <MoneyCell key={col.key} value={col.scenario.venue.overtime} faded={col.scenario.venue.overtime === 0} />
                  ))}
                </tr>

                {/* CATERING GROUP */}
                <tr className="bg-gray-50/60 border-t border-gray-100">
                  <td colSpan={columns.length + 1} className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                    Catering
                  </td>
                </tr>
                <tr className="border-t border-gray-100">
                  <td className="px-3 py-2 text-gray-500">Vendor</td>
                  {columns.map((col) => (
                    <td key={col.key} className="px-3 py-2 text-right font-medium text-gray-900 whitespace-nowrap">
                      {col.catering?.name ?? "—"}
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-gray-100">
                  <td className="px-3 py-2 text-gray-500">$ / person</td>
                  {columns.map((col) => (
                    <MoneyCell key={col.key} value={col.catering?.costModel?.perPerson ?? 0} />
                  ))}
                </tr>
                <tr className="border-t border-gray-100">
                  <td className="px-3 py-2 text-gray-500">Subtotal ({guestCount} ppl)</td>
                  {columns.map((col) => (
                    <MoneyCell key={col.key} value={col.scenario.catering.total} />
                  ))}
                </tr>

                {/* BAR GROUP */}
                <tr className="bg-gray-50/60 border-t border-gray-100">
                  <td colSpan={columns.length + 1} className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                    Bar — {barMode === "self_host" ? "Self-hosted" : "Through caterer"}
                  </td>
                </tr>
                <tr className="border-t border-gray-100">
                  <td className="px-3 py-2 text-gray-500">
                    {barMode === "self_host" ? "Flat budget" : `$/person × ${guestCount}`}
                  </td>
                  {columns.map((col) => (
                    <MoneyCell key={col.key} value={col.scenario.bar.total} />
                  ))}
                </tr>

                {/* TOTALS */}
                <tr className="border-t-2 border-gray-300 bg-[var(--accent)]/5">
                  <td className="px-3 py-2.5 font-semibold text-gray-900">Total</td>
                  {columns.map((col) => (
                    <td key={col.key} className="px-3 py-2.5 text-right font-semibold text-gray-900 tabular-nums whitespace-nowrap">
                      {fmtMoney(col.scenario.total)}
                    </td>
                  ))}
                </tr>
                {budget > 0 && (
                  <tr className="border-t border-gray-100">
                    <td className="px-3 py-2 text-gray-500">vs. total budget</td>
                    {columns.map((col) => {
                      const delta = budget - col.scenario.total;
                      const over = delta < 0;
                      return (
                        <td
                          key={col.key}
                          className={`px-3 py-2 text-right font-medium tabular-nums whitespace-nowrap ${
                            over ? "text-red-600" : "text-green-600"
                          }`}
                        >
                          {fmtSigned(delta)}
                        </td>
                      );
                    })}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* 3 — Scenario notes */}
      <Panel title="Scenario notes">
        <textarea
          value={comparison.notes}
          onChange={(e) => updateComparison({ notes: e.target.value })}
          placeholder="What's the trade-off? Plan B if rain pushes timing late? Notes save automatically."
          rows={4}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)] resize-y"
        />
      </Panel>
    </div>
  );
}
