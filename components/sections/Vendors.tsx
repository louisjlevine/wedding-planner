"use client";

import { useState } from "react";
import { usePlanStore } from "@/lib/plan-store";
import { Badge } from "@/components/ui/Badge";
import type { Vendor } from "@/lib/types";
import type { ResearchType } from "@/lib/research-prompts";

const STATUS_VARIANTS: Record<Vendor["status"], "gray" | "yellow" | "green" | "red"> = {
  considering: "gray",
  contacted:   "yellow",
  booked:      "green",
  rejected:    "red",
};

const CATEGORIES = [
  "Venue", "Photography", "Catering", "Florist", "Music",
  "Attire", "Hair & Makeup", "Transport", "Stationery", "Other",
];

// Map vendor category → research type (only categories that have a research section)
const CATEGORY_TO_RESEARCH: Partial<Record<string, ResearchType>> = {
  "Venue":        "venue",
  "Photography":  "photographer",
  "Catering":     "caterer",
  "Florist":      "florist",
  "Music":        "music",
  "Attire":       "dress",
};

// ── Inline vendor edit form ───────────────────────────────────────────────────

function EditVendorForm({
  vendor,
  onSave,
  onCancel,
}: {
  vendor: Vendor;
  onSave: (updates: Partial<Vendor>) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState({
    name:     vendor.name,
    category: vendor.category,
    contact:  vendor.contact  ?? "",
    website:  vendor.website  ?? "",
    price:    vendor.price?.toString() ?? "",
    notes:    vendor.notes    ?? "",
    status:   vendor.status,
  });

  function commit() {
    onSave({
      name:     draft.name.trim() || vendor.name,
      category: draft.category,
      contact:  draft.contact  || undefined,
      website:  draft.website  || undefined,
      price:    draft.price    ? parseInt(draft.price) : undefined,
      notes:    draft.notes    || undefined,
      status:   draft.status,
    });
  }

  return (
    <div className="bg-[var(--accent)]/5 border border-[var(--accent)] rounded-xl px-5 py-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Name</label>
          <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Category</label>
          <select value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]">
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Contact</label>
          <input value={draft.contact} onChange={(e) => setDraft((d) => ({ ...d, contact: e.target.value }))}
            placeholder="email or phone"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Website</label>
          <input value={draft.website} onChange={(e) => setDraft((d) => ({ ...d, website: e.target.value }))}
            placeholder="https://..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Estimated price ($)</label>
          <input type="number" value={draft.price} onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
            placeholder="0"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Status</label>
          <select value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as Vendor["status"] }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]">
            <option value="considering">Considering</option>
            <option value="contacted">Contacted</option>
            <option value="booked">Booked</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Notes</label>
        <textarea value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
          rows={2} placeholder="Any notes..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)] resize-none" />
      </div>
      <div className="flex gap-2">
        <button onClick={commit}
          className="px-4 py-2 bg-[var(--accent)] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-colors">
          Save
        </button>
        <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main Vendors page ─────────────────────────────────────────────────────────

export function Vendors() {
  const {
    vendors, addVendor, updateVendor, removeVendor,
    answers, setResearchNotes, setTriggerResearchFor, setActiveTab,
  } = usePlanStore();

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    category: "Venue", name: "", contact: "", website: "", price: "", notes: "",
  });

  // Per-vendor loading state for "Find similar"
  const [findingFor, setFindingFor] = useState<string | null>(null);

  function handleAdd() {
    if (!form.name.trim()) return;
    addVendor({
      id:       `vendor-${Date.now()}`,
      category: form.category,
      name:     form.name,
      contact:  form.contact  || undefined,
      website:  form.website  || undefined,
      price:    form.price    ? parseInt(form.price) : undefined,
      notes:    form.notes    || undefined,
      status:   "considering",
    });
    setForm({ category: "Venue", name: "", contact: "", website: "", price: "", notes: "" });
    setAdding(false);
  }

  async function handleFindSimilar(vendor: Vendor) {
    const researchType = CATEGORY_TO_RESEARCH[vendor.category];
    if (!researchType || !answers) return;

    setFindingFor(vendor.id);
    try {
      const res = await fetch("/api/vendor-description", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ vendor, answers }),
      });
      const data = await res.json();
      const description: string = data.description ?? `Looking for options similar to ${vendor.name}.`;

      // Prepend note so existing notes aren't lost
      const note = `Based on ${vendor.name}: ${description}`;
      setResearchNotes(researchType, note);
      setTriggerResearchFor(researchType);
      setActiveTab("research");
    } catch {
      // Fallback — navigate anyway with minimal note
      const note = `Looking for options similar to ${vendor.name} (${vendor.category}).`;
      setResearchNotes(researchType, note);
      setTriggerResearchFor(researchType);
      setActiveTab("research");
    } finally {
      setFindingFor(null);
    }
  }

  const grouped = vendors.reduce<Record<string, Vendor[]>>((acc, v) => {
    if (!acc[v.category]) acc[v.category] = [];
    acc[v.category].push(v);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Vendors</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {vendors.filter((v) => v.status === "booked").length} booked &middot;{" "}
            {vendors.length} total
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="px-4 py-2 bg-[var(--accent)] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-colors"
        >
          Add vendor
        </button>
      </div>

      {adding && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">New vendor</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
              >
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Vendor name"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Contact</label>
              <input
                value={form.contact}
                onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
                placeholder="email or phone"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Website</label>
              <input
                value={form.website}
                onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                placeholder="https://..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Estimated price ($)</label>
              <input
                type="number"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                placeholder="0"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Notes</label>
              <input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Any notes..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="px-4 py-2 bg-[var(--accent)] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-colors"
            >
              Add
            </button>
            <button
              onClick={() => setAdding(false)}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {vendors.length === 0 && !adding && (
        <div className="border-2 border-dashed border-gray-200 rounded-2xl py-16 flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">No vendors yet</p>
            <p className="text-xs text-gray-400 mt-0.5">Add venues, photographers, caterers and more</p>
          </div>
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Add your first vendor
          </button>
        </div>
      )}

      {Object.entries(grouped).map(([category, catVendors]) => (
        <div key={category}>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
            {category}
          </h2>
          <div className="space-y-2">
            {catVendors.map((vendor) => {
              const canFindSimilar = !!CATEGORY_TO_RESEARCH[vendor.category];
              const isLoading = findingFor === vendor.id;
              const isEditing = editingId === vendor.id;

              if (isEditing) {
                return (
                  <EditVendorForm
                    key={vendor.id}
                    vendor={vendor}
                    onSave={(updates) => { updateVendor(vendor.id, updates); setEditingId(null); }}
                    onCancel={() => setEditingId(null)}
                  />
                );
              }

              return (
                <div
                  key={vendor.id}
                  onClick={() => setEditingId(vendor.id)}
                  className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 cursor-pointer hover:border-[var(--accent)]/50 hover:-translate-y-0.5 transition-all duration-150"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{vendor.name}</p>
                      <Badge variant={STATUS_VARIANTS[vendor.status]}>{vendor.status}</Badge>
                    </div>
                    {vendor.website && (
                      <a
                        href={vendor.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-[var(--accent)] hover:underline mt-0.5 block truncate"
                      >
                        {vendor.website.replace(/^https?:\/\//, "")}
                      </a>
                    )}
                    {vendor.contact && (
                      <p className="text-xs text-gray-400 mt-0.5">{vendor.contact}</p>
                    )}
                    {vendor.price && (
                      <p className="text-xs text-gray-500 mt-0.5">Est. ${vendor.price.toLocaleString()}</p>
                    )}
                    {vendor.notes && (
                      <p className="text-xs text-gray-400 mt-1 italic line-clamp-2">{vendor.notes}</p>
                    )}
                  </div>

                  <div
                    className="flex flex-row sm:flex-col items-center sm:items-end gap-2 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-2">
                      <select
                        value={vendor.status}
                        onChange={(e) => updateVendor(vendor.id, { status: e.target.value as Vendor["status"] })}
                        className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-[var(--accent)]"
                      >
                        <option value="considering">Considering</option>
                        <option value="contacted">Contacted</option>
                        <option value="booked">Booked</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      {canFindSimilar && (
                        <button
                          onClick={() => handleFindSimilar(vendor)}
                          disabled={isLoading}
                          className="inline-flex items-center gap-1.5 text-xs text-gray-400 border border-gray-200 rounded-lg px-2.5 py-1 hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50 transition-colors"
                        >
                          {isLoading ? (
                            <>
                              <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                              Finding…
                            </>
                          ) : (
                            <>
                              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <circle cx="6.5" cy="6.5" r="4.5" />
                                <path d="M14 14l-3-3" />
                                <path d="M6.5 4v5M4 6.5h5" />
                              </svg>
                              Find similar
                            </>
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => removeVendor(vendor.id)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1 hover:bg-red-100 hover:border-red-300 transition-colors"
                      >
                        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9a1 1 0 001 1h6a1 1 0 001-1l1-9" />
                        </svg>
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
