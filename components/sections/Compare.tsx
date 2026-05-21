"use client";

import { useMemo } from "react";
import { usePlanStore } from "@/lib/plan-store";
import { Panel } from "@/components/ui/Panel";
import type { Vendor, BarMode, VenueComparisonConfig, CatererPackage } from "@/lib/types";
import { computeScenario, resolvePackage, type BarAddon } from "@/lib/compare-cost";
import { EditableMoneyCell, EditableNumberCell, fmtMoney } from "@/components/ui/EditableMoneyCell";

const STATUS_DOT: Record<Vendor["status"], string> = {
  considering: "bg-gray-400",
  contacted:   "bg-yellow-400",
  booked:      "bg-green-500",
  rejected:    "bg-red-400",
};

const BAR_MODE_LABEL: Record<BarMode, string> = {
  self_host:   "Self-host",
  via_caterer: "Through vendor",
};

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
  bars,
  onChange,
  onEditVenue,
}: {
  venue: Vendor;
  config: VenueComparisonConfig;
  caterers: Vendor[];
  bars: Vendor[];
  onChange: (partial: Partial<VenueComparisonConfig>) => void;
  onEditVenue: () => void;
}) {
  const caterer = caterers.find((c) => c.id === config.catererId);
  const barMode = venue.barMode;
  const barVendor =
    venue.barVendorId
      ? caterers.find((c) => c.id === venue.barVendorId) ??
        bars.find((b) => b.id === venue.barVendorId)
      : undefined;

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

      {/* Bar summary — fully set on the venue page */}
      <div>
        <p className="text-[11px] text-gray-500 mb-1">
          Bar — {barMode ? BAR_MODE_LABEL[barMode] : "not set"}
        </p>
        <div className="text-[12px] text-gray-700">
          {barMode === "self_host" && (
            <span>
              {venue.barSelfHostAmount !== undefined
                ? `$${venue.barSelfHostAmount.toLocaleString()} budget`
                : "No amount set"}
            </span>
          )}
          {barMode === "via_caterer" && (
            <span>
              {barVendor
                ? `${barVendor.name?.trim() || "Untitled"} (${barVendor.category})`
                : "No vendor selected"}
            </span>
          )}
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
      </div>
    </div>
  );
}

type Scenario = ReturnType<typeof computeScenario>;

// Shared styling tokens for the compare table. Centralising these keeps every
// section visually consistent — line items live one indent step inside their
// group, group headers stand out, and subtotal rows feel like a closing band.
const LINE_LABEL_CLS = "pl-8 pr-3 py-2 text-gray-600 text-xs";
const SUBTOTAL_ROW_CLS = "border-t border-gray-200 bg-gray-50/70";
const SUBTOTAL_LABEL_CLS = "px-3 py-2.5 text-xs font-semibold text-gray-800";
const SUBTOTAL_VALUE_CLS = "px-3 py-2.5 text-right tabular-nums font-semibold text-gray-900 whitespace-nowrap";
const GROUP_HEADER_ROW_CLS = "bg-gray-100/80 border-t-2 border-gray-200";
const GROUP_HEADER_CELL_CLS = "px-3 py-2 text-[11px] uppercase tracking-wider text-gray-700 font-bold";

// Read-only money cell, used for derived subtotals that shouldn't be edited.
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
    updateVendor, miscLineItemLabels, removeMiscLineItemLabel,
  } = usePlanStore();

  function openVendorEditor(vendorId: string) {
    setEditingVendorId(vendorId);
    setActiveTab("vendors");
  }

  // Rejected vendors don't belong in cost comparison.
  const venueOptions    = vendors.filter((v) => v.category === "Venue"    && v.status !== "rejected");
  const cateringOptions = vendors.filter((v) => v.category === "Catering" && v.status !== "rejected");
  const barOptions      = vendors.filter((v) => v.category === "Bar"      && v.status !== "rejected");

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
    barVendor?: Vendor;
    config: VenueComparisonConfig;
    scenario: Scenario;
  };

  const columns: Column[] = useMemo(() => {
    return venueSel.slice(0, 8).map((venue) => {
      const config = comparison.venueConfigs[venue.id] ?? {};
      const caterer = cateringOptions.find((c) => c.id === config.catererId);
      // Bar pricing is fully on the venue page now.
      const barVendor =
        venue.barMode === "via_caterer" && venue.barVendorId
          ? cateringOptions.find((c) => c.id === venue.barVendorId) ??
            barOptions.find((b) => b.id === venue.barVendorId)
          : undefined;
      const barAddon: BarAddon = {
        mode: venue.barMode ?? "self_host",
        flatBudget: venue.barSelfHostAmount,
      };
      return {
        key: venue.id,
        venue,
        caterer,
        barVendor,
        config,
        scenario: computeScenario(venue, caterer, config.packageId, barAddon, guestCount, hours, barVendor),
      };
    });
  }, [venueSel, cateringOptions, barOptions, comparison.venueConfigs, guestCount, hours]);

  const budget = answers?.budget ?? 0;
  const anySelected = venueSel.length > 0;

  // Show every shared library label as a row. Each cell maps to the venue's
  // miscLineItems entry for that label (caterer-side misc is folded into the
  // caterer column by source).
  const miscLabelRows = useMemo(
    () => [...miscLineItemLabels].sort((a, b) => a.label.localeCompare(b.label)),
    [miscLineItemLabels],
  );

  // ── Write-through helpers ─────────────────────────────────────────────────
  // Each editable cell on the table is wired to one of these. They all write
  // straight back to the source vendor so changes show up on the Vendors tab
  // immediately and the next render reflects the new totals.

  function updateLineItemCost(vendorId: string, labelId: string, label: string, next: number | undefined) {
    const vendor = vendors.find((v) => v.id === vendorId);
    if (!vendor) return;
    const existing = vendor.miscLineItems ?? [];
    if (next === undefined || !Number.isFinite(next)) {
      const filtered = existing.filter((m) => m.id !== labelId);
      updateVendor(vendorId, { miscLineItems: filtered.length ? filtered : undefined });
      return;
    }
    const idx = existing.findIndex((m) => m.id === labelId);
    const rows = idx === -1
      ? [...existing, { id: labelId, label, cost: next }]
      : existing.map((m, i) => (i === idx ? { ...m, label, cost: next } : m));
    updateVendor(vendorId, { miscLineItems: rows });
  }

  function updateCostModel(vendorId: string, field: "base" | "hoursIncluded" | "overtimeHourly" | "perPerson", next: number | undefined) {
    const vendor = vendors.find((v) => v.id === vendorId);
    if (!vendor) return;
    const cm = { ...(vendor.costModel ?? {}) };
    if (next === undefined) delete cm[field]; else cm[field] = next;
    const hasAny = Object.values(cm).some((v) => v !== undefined);
    updateVendor(vendorId, { costModel: hasAny ? cm : undefined });
  }

  function updateBarCostModel(vendorId: string, field: "base" | "perPerson", next: number | undefined) {
    const vendor = vendors.find((v) => v.id === vendorId);
    if (!vendor) return;
    const cm = { ...(vendor.barCostModel ?? {}) };
    if (next === undefined) delete cm[field]; else cm[field] = next;
    const hasAny = Object.values(cm).some((v) => v !== undefined);
    updateVendor(vendorId, { barCostModel: hasAny ? cm : undefined });
  }

  function updatePackageField(vendorId: string, packageId: string, field: "perPerson" | "base", next: number | undefined) {
    const vendor = vendors.find((v) => v.id === vendorId);
    if (!vendor?.packages) return;
    const packages: CatererPackage[] = vendor.packages.map((p) =>
      p.id === packageId ? { ...p, [field]: next } : p,
    );
    updateVendor(vendorId, { packages });
  }

  function updateBarSelfHostAmount(vendorId: string, next: number | undefined) {
    updateVendor(vendorId, { barSelfHostAmount: next });
  }

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
              type="text"
              inputMode="numeric"
              value={comparison.guestCount ?? answers?.guestCount ?? ""}
              placeholder={(answers?.guestCount ?? 100).toString()}
              onChange={(e) => {
                const cleaned = e.target.value.replace(/[^\d]/g, "");
                if (cleaned === "") { updateComparison({ guestCount: undefined }); return; }
                const n = parseInt(cleaned);
                updateComparison({ guestCount: Number.isFinite(n) ? n : undefined });
              }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
            />
            <p className="text-[11px] text-gray-400 mt-1">Drives catering & per-person bar totals.</p>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Event hours</label>
            <input
              type="text"
              inputMode="numeric"
              value={comparison.hours ?? 8}
              onChange={(e) => {
                const cleaned = e.target.value.replace(/[^\d]/g, "");
                if (cleaned === "") { updateComparison({ hours: undefined }); return; }
                const n = parseInt(cleaned);
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
                bars={barOptions}
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
                <tr className={GROUP_HEADER_ROW_CLS}>
                  <td colSpan={columns.length + 1} className={GROUP_HEADER_CELL_CLS}>
                    Venue
                  </td>
                </tr>
                <tr className="border-t border-gray-100">
                  <td className={LINE_LABEL_CLS}>Base cost</td>
                  {columns.map((col) => (
                    <td key={col.key} className="px-3 py-1 text-right">
                      <EditableMoneyCell
                        value={col.venue.costModel?.base}
                        onCommit={(n) => updateCostModel(col.venue.id, "base", n)}
                        ariaLabel={`${col.venue.name} base cost`}
                      />
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-gray-100">
                  <td className={LINE_LABEL_CLS}>Hours included</td>
                  {columns.map((col) => (
                    <td key={col.key} className="px-3 py-1 text-right">
                      <EditableNumberCell
                        value={col.venue.costModel?.hoursIncluded}
                        onCommit={(n) => updateCostModel(col.venue.id, "hoursIncluded", n)}
                        ariaLabel={`${col.venue.name} hours included`}
                        suffix="h"
                      />
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-gray-100">
                  <td className={LINE_LABEL_CLS}>Overtime $ / hour</td>
                  {columns.map((col) => (
                    <td key={col.key} className="px-3 py-1 text-right">
                      <EditableMoneyCell
                        value={col.venue.costModel?.overtimeHourly}
                        onCommit={(n) => updateCostModel(col.venue.id, "overtimeHourly", n)}
                        ariaLabel={`${col.venue.name} overtime hourly`}
                        fadeEmpty
                      />
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-gray-100">
                  <td className={LINE_LABEL_CLS}>Overtime ({hours}h event)</td>
                  {columns.map((col) => (
                    <MoneyCell key={col.key} value={col.scenario.venue.overtime} faded={col.scenario.venue.overtime === 0} />
                  ))}
                </tr>
                <tr className={SUBTOTAL_ROW_CLS}>
                  <td className={SUBTOTAL_LABEL_CLS}>Venue subtotal</td>
                  {columns.map((col) => (
                    <td key={col.key} className={SUBTOTAL_VALUE_CLS}>{fmtMoney(col.scenario.venue.total)}</td>
                  ))}
                </tr>

                {/* CATERING GROUP */}
                <tr className={GROUP_HEADER_ROW_CLS}>
                  <td colSpan={columns.length + 1} className={GROUP_HEADER_CELL_CLS}>
                    Catering
                  </td>
                </tr>
                <tr className="border-t border-gray-100">
                  <td className={LINE_LABEL_CLS}>Caterer</td>
                  {columns.map((col) => (
                    <td key={col.key} className="px-3 py-1 text-right text-gray-700 whitespace-nowrap">
                      <select
                        value={col.config.catererId ?? ""}
                        onChange={(e) => {
                          const catererId = e.target.value || undefined;
                          updateVenueConfig(col.venue.id, { catererId, packageId: undefined });
                        }}
                        className="w-full text-right text-xs border border-transparent hover:border-gray-200 focus:border-[var(--accent)] focus:outline-none rounded px-2 py-1 bg-transparent"
                      >
                        <option value="">— none —</option>
                        {cateringOptions.map((c) => (
                          <option key={c.id} value={c.id}>{c.name?.trim() || "Untitled"}</option>
                        ))}
                      </select>
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-gray-100">
                  <td className={LINE_LABEL_CLS}>Package</td>
                  {columns.map((col) => {
                    const pkgs = col.caterer?.packages ?? [];
                    if (pkgs.length === 0) {
                      return (
                        <td key={col.key} className="px-3 py-2 text-right text-gray-300">—</td>
                      );
                    }
                    const selected = resolvePackage(col.caterer, col.config.packageId)?.id ?? pkgs[0].id;
                    return (
                      <td key={col.key} className="px-3 py-1 text-right whitespace-nowrap">
                        <select
                          value={selected}
                          onChange={(e) => updateVenueConfig(col.venue.id, { packageId: e.target.value })}
                          className="w-full text-right text-xs border border-transparent hover:border-gray-200 focus:border-[var(--accent)] focus:outline-none rounded px-2 py-1 bg-transparent"
                        >
                          {pkgs.map((p) => (
                            <option key={p.id} value={p.id}>{p.name || "Untitled"}</option>
                          ))}
                        </select>
                      </td>
                    );
                  })}
                </tr>
                <tr className="border-t border-gray-100">
                  <td className={LINE_LABEL_CLS}>$ / person</td>
                  {columns.map((col) => {
                    const pkg = resolvePackage(col.caterer, col.config.packageId);
                    if (col.caterer && pkg) {
                      return (
                        <td key={col.key} className="px-3 py-1 text-right">
                          <EditableMoneyCell
                            value={pkg.perPerson}
                            onCommit={(n) => updatePackageField(col.caterer!.id, pkg.id, "perPerson", n)}
                            ariaLabel={`${col.caterer.name} ${pkg.name} per person`}
                          />
                        </td>
                      );
                    }
                    if (col.caterer) {
                      return (
                        <td key={col.key} className="px-3 py-1 text-right">
                          <EditableMoneyCell
                            value={col.caterer.costModel?.perPerson}
                            onCommit={(n) => updateCostModel(col.caterer!.id, "perPerson", n)}
                            ariaLabel={`${col.caterer.name} per person`}
                          />
                        </td>
                      );
                    }
                    return <td key={col.key} className="px-3 py-2 text-right text-gray-300">—</td>;
                  })}
                </tr>
                <tr className="border-t border-gray-100">
                  <td className={LINE_LABEL_CLS}>Catering base</td>
                  {columns.map((col) => {
                    const pkg = resolvePackage(col.caterer, col.config.packageId);
                    if (col.caterer && pkg) {
                      return (
                        <td key={col.key} className="px-3 py-1 text-right">
                          <EditableMoneyCell
                            value={pkg.base}
                            onCommit={(n) => updatePackageField(col.caterer!.id, pkg.id, "base", n)}
                            ariaLabel={`${col.caterer.name} ${pkg.name} base`}
                            fadeEmpty
                          />
                        </td>
                      );
                    }
                    if (col.caterer) {
                      return (
                        <td key={col.key} className="px-3 py-1 text-right">
                          <EditableMoneyCell
                            value={col.caterer.costModel?.base}
                            onCommit={(n) => updateCostModel(col.caterer!.id, "base", n)}
                            ariaLabel={`${col.caterer.name} base`}
                            fadeEmpty
                          />
                        </td>
                      );
                    }
                    return <td key={col.key} className="px-3 py-2 text-right text-gray-300">—</td>;
                  })}
                </tr>
                <tr className={SUBTOTAL_ROW_CLS}>
                  <td className={SUBTOTAL_LABEL_CLS}>Catering subtotal <span className="text-gray-400 font-normal">({guestCount} ppl)</span></td>
                  {columns.map((col) => (
                    <td key={col.key} className={SUBTOTAL_VALUE_CLS}>{fmtMoney(col.scenario.catering.total)}</td>
                  ))}
                </tr>

                {/* BAR GROUP */}
                <tr className={GROUP_HEADER_ROW_CLS}>
                  <td colSpan={columns.length + 1} className={GROUP_HEADER_CELL_CLS}>
                    Bar
                  </td>
                </tr>
                <tr className="border-t border-gray-100">
                  <td className={LINE_LABEL_CLS}>Mode</td>
                  {columns.map((col) => (
                    <td key={col.key} className="px-3 py-2 text-right text-gray-700 whitespace-nowrap text-xs">
                      {col.venue.barMode ? BAR_MODE_LABEL[col.venue.barMode] : (
                        <button
                          type="button"
                          onClick={() => openVendorEditor(col.venue.id)}
                          className="text-[var(--accent)] hover:opacity-80 text-xs"
                        >
                          Set on venue →
                        </button>
                      )}
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-gray-100">
                  <td className={LINE_LABEL_CLS}>Bar vendor</td>
                  {columns.map((col) => (
                    <td key={col.key} className="px-3 py-2 text-right text-gray-700 whitespace-nowrap text-xs">
                      {col.venue.barMode === "via_caterer" && col.barVendor ? (
                        <span className="inline-flex items-center gap-1.5 justify-end">
                          <span>{col.barVendor.name}</span>
                          <button
                            type="button"
                            onClick={() => openVendorEditor(col.barVendor!.id)}
                            className="text-gray-300 hover:text-[var(--accent)] transition-colors"
                            title="Edit bar vendor costs"
                            aria-label={`Edit ${col.barVendor.name} costs`}
                          >
                            <EditPencil />
                          </button>
                        </span>
                      ) : col.venue.barMode === "self_host" ? (
                        <span className="text-gray-400 italic">self-host</span>
                      ) : "—"}
                    </td>
                  ))}
                </tr>
                {/* Self-host total budget — editable when applicable */}
                <tr className="border-t border-gray-100">
                  <td className={LINE_LABEL_CLS}>Self-host budget</td>
                  {columns.map((col) => {
                    if (col.venue.barMode !== "self_host") {
                      return <td key={col.key} className="px-3 py-2 text-right text-gray-300">—</td>;
                    }
                    return (
                      <td key={col.key} className="px-3 py-1 text-right">
                        <EditableMoneyCell
                          value={col.venue.barSelfHostAmount}
                          onCommit={(n) => updateBarSelfHostAmount(col.venue.id, n)}
                          ariaLabel={`${col.venue.name} self-host bar budget`}
                        />
                      </td>
                    );
                  })}
                </tr>
                <tr className="border-t border-gray-100">
                  <td className={LINE_LABEL_CLS}>Base / setup</td>
                  {columns.map((col) => {
                    if (col.venue.barMode !== "via_caterer" || !col.barVendor) {
                      return <MoneyCell key={col.key} value={col.scenario.bar.base} faded={col.scenario.bar.base === 0} />;
                    }
                    const isCaterer = col.barVendor.category === "Catering";
                    const currentBase = isCaterer ? col.barVendor.barCostModel?.base : col.barVendor.costModel?.base;
                    return (
                      <td key={col.key} className="px-3 py-1 text-right">
                        <EditableMoneyCell
                          value={currentBase}
                          onCommit={(n) =>
                            isCaterer
                              ? updateBarCostModel(col.barVendor!.id, "base", n)
                              : updateCostModel(col.barVendor!.id, "base", n)
                          }
                          ariaLabel={`${col.barVendor.name} bar base`}
                          fadeEmpty
                        />
                      </td>
                    );
                  })}
                </tr>
                <tr className="border-t border-gray-100">
                  <td className={LINE_LABEL_CLS}>Bar $ / person</td>
                  {columns.map((col) => {
                    if (col.venue.barMode !== "via_caterer" || !col.barVendor) {
                      return <td key={col.key} className="px-3 py-2 text-right text-gray-300">—</td>;
                    }
                    const isCaterer = col.barVendor.category === "Catering";
                    const currentPerPerson = isCaterer ? col.barVendor.barCostModel?.perPerson : col.barVendor.costModel?.perPerson;
                    return (
                      <td key={col.key} className="px-3 py-1 text-right">
                        <EditableMoneyCell
                          value={currentPerPerson}
                          onCommit={(n) =>
                            isCaterer
                              ? updateBarCostModel(col.barVendor!.id, "perPerson", n)
                              : updateCostModel(col.barVendor!.id, "perPerson", n)
                          }
                          ariaLabel={`${col.barVendor.name} bar per person`}
                        />
                      </td>
                    );
                  })}
                </tr>
                <tr className={SUBTOTAL_ROW_CLS}>
                  <td className={SUBTOTAL_LABEL_CLS}>Bar subtotal</td>
                  {columns.map((col) => (
                    <td key={col.key} className={SUBTOTAL_VALUE_CLS}>{fmtMoney(col.scenario.bar.total)}</td>
                  ))}
                </tr>

                {/* MISC GROUP — shared library, editable inline */}
                {miscLabelRows.length > 0 && (
                  <>
                    <tr className={GROUP_HEADER_ROW_CLS}>
                      <td colSpan={columns.length + 1} className={GROUP_HEADER_CELL_CLS}>
                        Misc
                      </td>
                    </tr>
                    {miscLabelRows.map((lbl) => (
                      <tr key={lbl.id} className="border-t border-gray-100">
                        <td className={LINE_LABEL_CLS}>
                          <span className="inline-flex items-center gap-1.5">
                            <span>{lbl.label}</span>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Delete "${lbl.label}" from every vendor?`)) {
                                  removeMiscLineItemLabel(lbl.id);
                                }
                              }}
                              className="text-gray-300 hover:text-red-400 transition-colors"
                              title="Remove from all vendors"
                              aria-label={`Remove ${lbl.label}`}
                            >
                              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <path d="M1 1l10 10M11 1L1 11" />
                              </svg>
                            </button>
                          </span>
                        </td>
                        {columns.map((col) => {
                          const existing = col.venue.miscLineItems?.find((m) => m.id === lbl.id)?.cost;
                          return (
                            <td key={col.key} className="px-3 py-1 text-right">
                              <EditableMoneyCell
                                value={existing}
                                onCommit={(n) => updateLineItemCost(col.venue.id, lbl.id, lbl.label, n)}
                                ariaLabel={`${col.venue.name} ${lbl.label}`}
                                fadeEmpty
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    <tr className={SUBTOTAL_ROW_CLS}>
                      <td className={SUBTOTAL_LABEL_CLS}>Misc subtotal</td>
                      {columns.map((col) => (
                        <td key={col.key} className={SUBTOTAL_VALUE_CLS}>{fmtMoney(col.scenario.misc.total)}</td>
                      ))}
                    </tr>
                  </>
                )}

                {/* TOTALS */}
                <tr className="border-t-2 border-[var(--accent)]/40 bg-[var(--accent)]/10">
                  <td className="px-3 py-3 text-sm font-bold text-gray-900">Total</td>
                  {columns.map((col) => (
                    <td key={col.key} className="px-3 py-3 text-right font-bold text-gray-900 tabular-nums whitespace-nowrap text-sm">
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
