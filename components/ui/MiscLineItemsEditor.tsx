"use client";

import { useState } from "react";
import { usePlanStore } from "@/lib/plan-store";
import type { MiscLineItem } from "@/lib/types";

interface Props {
  // Local draft state owned by the parent form. The editor renders one row per
  // label in the shared library, with the cost coming from this draft.
  items: MiscLineItem[];
  onChange: (next: MiscLineItem[]) => void;
}

// Renders the shared misc-line-item editor. Every entry in the global library
// shows up as a row; the user fills in (or clears) the per-vendor cost. Adding
// a new label adds it to the library so other vendors see it too. Removing a
// label deletes it from the library and from every vendor that referenced it.
export function MiscLineItemsEditor({ items, onChange }: Props) {
  const { miscLineItemLabels, addMiscLineItemLabel, removeMiscLineItemLabel } = usePlanStore();
  const [draftLabel, setDraftLabel] = useState("");

  // Local string state per-row so a freshly-cleared input doesn't snap back to
  // "0". Keyed by label id; missing key falls back to the numeric value.
  const [rawCosts, setRawCosts] = useState<Record<string, string>>({});

  function setCostForLabel(labelId: string, label: string, raw: string) {
    setRawCosts((m) => ({ ...m, [labelId]: raw }));
    const n = parseFloat(raw);
    const trimmed = raw.trim();
    const existing = items.find((m) => m.id === labelId);
    if (trimmed === "" || !Number.isFinite(n)) {
      // Clearing the input removes this vendor's cost for the label (the
      // label itself stays in the shared library).
      if (existing) {
        onChange(items.filter((m) => m.id !== labelId));
      }
      return;
    }
    if (existing) {
      onChange(items.map((m) => (m.id === labelId ? { ...m, cost: n, label } : m)));
    } else {
      onChange([...items, { id: labelId, label, cost: n }]);
    }
  }

  function handleAdd() {
    const trimmed = draftLabel.trim();
    if (!trimmed) return;
    addMiscLineItemLabel(trimmed);
    setDraftLabel("");
  }

  function handleRemoveLabel(labelId: string, label: string) {
    const confirmed = window.confirm(
      `Delete "${label}" from every vendor?\n\nThis line item will be removed from this vendor and any other vendor that has a cost recorded for it. There's no undo.`,
    );
    if (!confirmed) return;
    removeMiscLineItemLabel(labelId);
    // Also drop it from the parent's draft so the in-progress form view stays in sync.
    onChange(items.filter((m) => m.id !== labelId));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Misc line items</p>
      </div>
      <p className="text-[11px] text-gray-400 italic">
        Shared across all vendors. Add a line once and fill in costs per vendor — empty rows are skipped on Compare.
      </p>

      {miscLineItemLabels.length === 0 ? (
        <p className="text-[11px] text-gray-400 italic">No shared line items yet.</p>
      ) : (
        <div className="space-y-1.5">
          {miscLineItemLabels.map((lbl) => {
            const item = items.find((m) => m.id === lbl.id);
            const raw =
              rawCosts[lbl.id] !== undefined
                ? rawCosts[lbl.id]
                : item && Number.isFinite(item.cost) && item.cost !== 0
                  ? String(item.cost)
                  : "";
            return (
              <div key={lbl.id} className="flex items-center gap-2">
                <span className="flex-1 text-sm text-gray-700 truncate">{lbl.label}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={raw}
                  onChange={(e) => setCostForLabel(lbl.id, lbl.label, e.target.value.replace(/[^\d.,\-]/g, ""))}
                  placeholder="Cost"
                  className="w-28 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--accent)]"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveLabel(lbl.id, lbl.label)}
                  className="text-gray-300 hover:text-red-400 transition-colors shrink-0"
                  aria-label={`Remove ${lbl.label} from all vendors`}
                  title="Remove from all vendors"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M1 1l10 10M11 1L1 11" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <input
          value={draftLabel}
          onChange={(e) => setDraftLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draftLabel.trim()) {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder="New line item label (e.g. cleanup, chairs)"
          className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--accent)]"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!draftLabel.trim()}
          className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500 hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40 transition-colors"
        >
          Add line
        </button>
      </div>
    </div>
  );
}
