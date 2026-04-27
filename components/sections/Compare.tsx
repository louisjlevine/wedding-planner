"use client";

import { useMemo } from "react";
import { usePlanStore } from "@/lib/plan-store";
import { Panel } from "@/components/ui/Panel";
import type { Vendor, BarMode, VenueComparisonConfig } from "@/lib/types";
import { computeScenario, resolvePackage, type BarAddon } from "@/lib/compare-cost";

const STATUS_DOT: Record<Vendor["status"], string> = {
  considering: "bg-gray-400",
  contacted:   "bg-yellow-400",
  booked:      "bg-green-500",
  rejected:    "bg-red-400",
};

const BAR_MODE_LABEL: Record<BarMode, string> = {
  self_host:   "Self-host",
  via_caterer: "Through caterer",
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

// Pencil icon for "edit costs" links that jump to the Vendors tab.
function EditPencil({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
    </svg>
  );
}

// ── Venue chip selector ──────────────────────────────────────────────────────

function VenuePicker({
  vendors,
  selectedIds,
  onToggle,
}: {
  vendors: Vendor[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Venues <span className="text-gray-400 font-normal normal-case">({vendors.length})</span>
      </p>
      {vendors.length === 0 ? (
        <p className="text-xs text-gray-400 italic">
          No venue vendors yet — add them on the Vendors tab.
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

// ── Per-venue config card ────────────────────────────────────────────────────

function VenueConfigCard({
  venue,
  config,
  caterers,
  guestCount,
  onChange,
  onEditVenue,
}: {
  venue: Vendor;
  config: VenueComparisonConfig;
  caterers: Vendor[];
  guestCount: number;
  onChange: (partial: Partial<VenueComparisonConfig>) => void;
  onEditVenue: () => void;
}) {
  const caterer = caterers.find((c) => c.id === config.catererId);
  const barMode = venue.barMode;

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-white">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[venue.status]}`} />
          <p className="text-sm font-semibold text-gray-900 truncate">{venue.name?.trim() || "Untitled"}</p>
        </div>
        <button
          type="button"
          onClick={onEditVenue}
          className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-[var(--accent)] transition-colors shrink-0"
          title="Edit this venue's costs in the Vendors tab"
        >
          <EditPencil />
          Edit costs
        </button>
      </div>

      {/* Caterer pick */}
      <div>
        <label className="text-[11px] text-gray-500 mb-1 block">Caterer</label>
        <select
          value={config.catererId ?? ""}
          onChange={(e) => {
            const catererId = e.target.value || undefined;
            // Clearing or changing caterer also clears package selection.
            onChange({ catererId, packageId: undefined });
          }}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
        >
          <option value="">— Select caterer —</option>
          {caterers.map((c) => (
            <option key={c.id} value={c.id}>{c.name?.trim() || "Untitled"}</option>
          ))}
        </select>
      </div>

      {/* Package pick (when caterer has packages) */}
      {caterer && caterer.packages && caterer.packages.length > 0 && (
        <div>
          <label className="text-[11px] text-gray-500 mb-1 block">Package</label>
          <select
            value={config.packageId ?? caterer.packages[0].id}
            onChange={(e) => onChange({ packageId: e.target.value })}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
          >
            {caterer.packages.map((p) => {
              const parts: string[] = [];
              if (p.perPerson) parts.push(`$${p.perPerson}/pp`);
              if (p.base)      parts.push(`$${p.base.toLocaleString()} base`);
              const tail = parts.length ? ` — ${parts.join(" + ")}` : "";
              return (
                <option key={p.id} value={p.id}>{p.name}{tail}</option>
              );
            })}
          </select>
        </div>
      )}

      {/* Bar input — mode is set on the venue, only the amount lives here */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-[11px] text-gray-500">
            Bar — {barMode ? BAR_MODE_LABEL[barMode] : "not set"}
          </p>
          {!barMode && (
            <button
              type="button"
              onClick={onEditVenue}
              className="text-[11px] text-[var(--accent)] hover:opacity-80"
            >
              Set on venue →
            </button>
          )}
        </div>
        {barMode === "self_host" && (
          <div>
            <label className="text-[11px] text-gray-500 mb-1 block">Total alcohol budget ($)</label>
            <input
              type="number"
              value={config.barFlatBudget ?? ""}
              placeholder="e.g. 2500"
              onChange={(e) => {
                const n = parseFloat(e.target.value);
                onChange({ barFlatBudget: Number.isFinite(n) ? n : undefined });
              }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
        )}
        {barMode === "via_caterer" && (
          <div>
            <label className="text-[11px] text-gray-500 mb-1 block">$ / person × {guestCount}</label>
            <input
              type="number"
              value={config.barPerPerson ?? ""}
              placeholder="e.g. 25"
              onChange={(e) => {
                const n = parseFloat(e.target.value);
                onChange({ barPerPerson: Number.isFinite(n) ? n : undefined });
              }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
        )}
      </div>
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
  const {
    vendors, answers, comparison,
    updateComparison, updateVenueConfig,
    setActiveTab, setEditingVendorId,
  } = usePlanStore();

  function openVendorEditor(vendorId: string) {
    setEditingVendorId(vendorId);
    setActiveTab("vendors");
  }

  // Rejected vendors don't belong in cost comparison.
  const venueOptions    = vendors.filter((v) => v.category === "Venue"    && v.status !== "rejected");
  const cateringOptions = vendors.filter((v) => v.category === "Catering" && v.status !== "rejected");

  function toggleVenue(id: string) {
    const current = comparison.venueIds;
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : [...current, id];
    updateComparison({ venueIds: next });
  }

  const guestCount = comparison.guestCount ?? answers?.guestCount ?? 100;
  const hours      = comparison.hours ?? 8;

  const venueSel = venueOptions.filter((v) => comparison.venueIds.includes(v.id));

  type Column = {
    key: string;
    venue: Vendor;
    caterer?: Vendor;
    config: VenueComparisonConfig;
    scenario: Scenario;
  };

  const columns: Column[] = useMemo(() => {
    return venueSel.slice(0, 8).map((venue) => {
      const config = comparison.venueConfigs[venue.id] ?? {};
      const caterer = cateringOptions.find((c) => c.id === config.catererId);
      // Bar mode is set on the venue; default to self_host so the addon is
      // still computable (with a zero total) when no mode is chosen yet.
      const barAddon: BarAddon = {
        mode: venue.barMode ?? "self_host",
        flatBudget: config.barFlatBudget,
        perPerson: config.barPerPerson,
      };
      return {
        key: venue.id,
        venue,
        caterer,
        config,
        scenario: computeScenario(venue, caterer, config.packageId, barAddon, guestCount, hours),
      };
    });
  }, [venueSel, cateringOptions, comparison.venueConfigs, guestCount, hours]);

  const budget = answers?.budget ?? 0;
  const anySelected = venueSel.length > 0;

  // Build a sorted union of misc labels that appear in any column so each
  // label gets its own row, with "—" in columns that don't include it.
  const miscLabels = useMemo(() => {
    const set = new Set<string>();
    for (const col of columns) {
      for (const m of col.scenario.misc.items) set.add(m.label);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [columns]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Compare</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Side-by-side cost per venue. Pick a caterer and package per venue. Bar mode and misc items come from each vendor.
        </p>
      </div>

      {/* 1 — Pick venues */}
      <Panel title="Choose venues to compare">
        <VenuePicker
          vendors={venueOptions}
          selectedIds={comparison.venueIds}
          onToggle={toggleVenue}
        />
      </Panel>

      {/* 2 — Event assumptions */}
      <Panel title="Event assumptions">
        <div className="grid grid-cols-2 gap-4 max-w-md">
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
      </Panel>

      {/* 3 — Per-venue config cards */}
      {anySelected && (
        <Panel title="Per-venue setup">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {venueSel.map((venue) => (
              <VenueConfigCard
                key={venue.id}
                venue={venue}
                config={comparison.venueConfigs[venue.id] ?? {}}
                caterers={cateringOptions}
                guestCount={guestCount}
                onChange={(partial) => updateVenueConfig(venue.id, partial)}
                onEditVenue={() => openVendorEditor(venue.id)}
              />
            ))}
          </div>
        </Panel>
      )}

      {/* 4 — Side-by-side cost table */}
      <Panel title="Side-by-side cost">
        {!anySelected ? (
          <p className="text-sm text-gray-400 italic">
            Pick at least one venue above to see the cost breakdown.
          </p>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-xs border border-gray-200 rounded-xl overflow-hidden">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-3 py-2 font-medium text-gray-500 w-44">Line item</th>
                  {columns.map((col) => (
                    <th key={col.key} className="px-3 py-2 font-medium text-gray-700 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <span>{col.venue.name?.trim() || "Untitled"}</span>
                        <button
                          type="button"
                          onClick={() => openVendorEditor(col.venue.id)}
                          className="text-gray-300 hover:text-[var(--accent)] transition-colors"
                          title="Edit venue costs"
                          aria-label={`Edit ${col.venue.name} costs`}
                        >
                          <EditPencil />
                        </button>
                      </div>
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
                  <td className="px-3 py-2 text-gray-500">Base cost</td>
                  {columns.map((col) => (
                    <MoneyCell key={col.key} value={col.scenario.venue.base} />
                  ))}
                </tr>
                <tr className="border-t border-gray-100">
                  <td className="px-3 py-2 text-gray-500">Hours included</td>
                  {columns.map((col) => (
                    <td key={col.key} className="px-3 py-2 text-right text-gray-700 tabular-nums">
                      {col.venue.costModel?.hoursIncluded ?? "—"}
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
                  <td className="px-3 py-2 text-gray-500">Caterer</td>
                  {columns.map((col) => (
                    <td key={col.key} className="px-3 py-2 text-right font-medium text-gray-900 whitespace-nowrap">
                      {col.caterer ? (
                        <span className="inline-flex items-center gap-1.5 justify-end">
                          <span>{col.caterer.name}</span>
                          <button
                            type="button"
                            onClick={() => openVendorEditor(col.caterer!.id)}
                            className="text-gray-300 hover:text-[var(--accent)] transition-colors"
                            title="Edit caterer costs"
                            aria-label={`Edit ${col.caterer.name} costs`}
                          >
                            <EditPencil />
                          </button>
                        </span>
                      ) : "—"}
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-gray-100">
                  <td className="px-3 py-2 text-gray-500">Package</td>
                  {columns.map((col) => {
                    const pkg = resolvePackage(col.caterer, col.config.packageId);
                    return (
                      <td key={col.key} className="px-3 py-2 text-right text-gray-700 whitespace-nowrap">
                        {pkg?.name ?? "—"}
                      </td>
                    );
                  })}
                </tr>
                <tr className="border-t border-gray-100">
                  <td className="px-3 py-2 text-gray-500">$ / person</td>
                  {columns.map((col) => {
                    const pkg = resolvePackage(col.caterer, col.config.packageId);
                    const pp = pkg?.perPerson ?? col.caterer?.costModel?.perPerson ?? 0;
                    return <MoneyCell key={col.key} value={pp} />;
                  })}
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
                    Bar
                  </td>
                </tr>
                <tr className="border-t border-gray-100">
                  <td className="px-3 py-2 text-gray-500">Mode</td>
                  {columns.map((col) => (
                    <td key={col.key} className="px-3 py-2 text-right text-gray-700 whitespace-nowrap">
                      {col.venue.barMode ? BAR_MODE_LABEL[col.venue.barMode] : "—"}
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-gray-100">
                  <td className="px-3 py-2 text-gray-500">Subtotal</td>
                  {columns.map((col) => (
                    <MoneyCell key={col.key} value={col.scenario.bar.total} />
                  ))}
                </tr>

                {/* MISC GROUP — render only if any column has misc items */}
                {miscLabels.length > 0 && (
                  <>
                    <tr className="bg-gray-50/60 border-t border-gray-100">
                      <td colSpan={columns.length + 1} className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                        Misc
                      </td>
                    </tr>
                    {miscLabels.map((label) => (
                      <tr key={label} className="border-t border-gray-100">
                        <td className="px-3 py-2 text-gray-500">{label}</td>
                        {columns.map((col) => {
                          const match = col.scenario.misc.items.find((m) => m.label === label);
                          return <MoneyCell key={col.key} value={match?.cost ?? 0} faded={!match} />;
                        })}
                      </tr>
                    ))}
                    <tr className="border-t border-gray-100">
                      <td className="px-3 py-2 text-gray-500">Subtotal</td>
                      {columns.map((col) => (
                        <MoneyCell key={col.key} value={col.scenario.misc.total} />
                      ))}
                    </tr>
                  </>
                )}

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

      {/* 5 — Scenario notes */}
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
