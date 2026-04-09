"use client";

import { useState, useRef, useEffect } from "react";
import { usePlanStore } from "@/lib/plan-store";
import type { Vendor } from "@/lib/types";
import type { ResearchType } from "@/lib/research-prompts";

const STATUS_DOT: Record<Vendor["status"], string> = {
  considering: "bg-gray-400",
  contacted:   "bg-yellow-400",
  booked:      "bg-green-500",
  rejected:    "bg-red-400",
};

const TAGS = ["Toured", "Has Quote", "Priority", "Referred", "Waitlisted"] as const;

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

// ── Combined status + tags selector ──────────────────────────────────────────

function StatusTagsSelector({
  vendor,
  onUpdate,
}: {
  vendor: Vendor;
  onUpdate: (updates: Partial<Vendor>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const tags = vendor.tags ?? [];

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 hover:border-[var(--accent)] transition-colors"
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[vendor.status]}`} />
        <span className="capitalize">{vendor.status}</span>
        {tags.length > 0 && (
          <span className="text-gray-400 font-normal">· {tags.join(", ")}</span>
        )}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-gray-400 ml-0.5">
          <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-3 z-20 min-w-[170px]">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Status</p>
          <div className="space-y-1.5 mb-3">
            {(["considering", "contacted", "booked", "rejected"] as const).map((s) => (
              <label key={s} className="flex items-center gap-2 cursor-pointer group">
                <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[s]}`} />
                <input
                  type="radio"
                  name={`status-${vendor.id}`}
                  checked={vendor.status === s}
                  onChange={() => onUpdate({ status: s })}
                  className="sr-only"
                />
                <span className={`text-xs capitalize ${vendor.status === s ? "font-semibold text-gray-900" : "text-gray-500 group-hover:text-gray-700"}`}>
                  {s}
                </span>
              </label>
            ))}
          </div>

          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tags</p>
          <div className="space-y-1.5">
            {TAGS.map((tag) => {
              const active = tags.includes(tag);
              return (
                <label key={tag} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => {
                      const newTags = e.target.checked
                        ? [...tags, tag]
                        : tags.filter((t) => t !== tag);
                      onUpdate({ tags: newTags });
                    }}
                    className="w-3 h-3 accent-[var(--accent)] cursor-pointer"
                  />
                  <span className={`text-xs ${active ? "font-semibold text-gray-900" : "text-gray-500 group-hover:text-gray-700"}`}>
                    {tag}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

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
    name:          vendor.name,
    category:      vendor.category,
    contact:       vendor.contact       ?? "",
    website:       vendor.website       ?? "",
    price:         vendor.price?.toString() ?? "",
    notes:         vendor.notes         ?? "",
    status:        vendor.status,
    tags:          vendor.tags          ?? [] as string[],
    rentalPeriod:  vendor.rentalPeriod  ?? "",
    overtimeRate:  vendor.overtimeRate  ?? "",
  });

  const isVenue = draft.category === "Venue";

  function commit() {
    onSave({
      name:         draft.name.trim() || vendor.name,
      category:     draft.category,
      contact:      draft.contact      || undefined,
      website:      draft.website      || undefined,
      price:        draft.price        ? parseInt(draft.price) : undefined,
      notes:        draft.notes        || undefined,
      status:       draft.status,
      tags:         draft.tags.length  ? draft.tags : undefined,
      rentalPeriod: isVenue ? (draft.rentalPeriod || undefined) : undefined,
      overtimeRate: isVenue ? (draft.overtimeRate || undefined) : undefined,
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
        <div className="col-span-2">
          <label className="text-xs text-gray-500 mb-1.5 block">Tags</label>
          <div className="flex flex-wrap gap-2">
            {TAGS.map((tag) => {
              const active = draft.tags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setDraft((d) => ({
                    ...d,
                    tags: active ? d.tags.filter((t) => t !== tag) : [...d.tags, tag],
                  }))}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    active
                      ? "bg-[var(--accent)] text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
        {isVenue && (
          <>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Rental period</label>
              <input value={draft.rentalPeriod} onChange={(e) => setDraft((d) => ({ ...d, rentalPeriod: e.target.value }))}
                placeholder="e.g. 8 hours, full day"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Overtime rate</label>
              <input value={draft.overtimeRate} onChange={(e) => setDraft((d) => ({ ...d, overtimeRate: e.target.value }))}
                placeholder="e.g. $250/hour"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]" />
            </div>
          </>
        )}
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

// ── Setup instructions panel ──────────────────────────────────────────────────

function SetupPanel({ onClose }: { onClose: () => void }) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://your-app.com";
  const importEndpoint = `${appUrl}/api/vendors/import`;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">Import setup</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
      </div>

      {/* iOS Shortcut */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">iOS Shortcut</p>
        <p className="text-xs text-gray-600 mb-3">
          Add a &ldquo;Save to Wedding Planner&rdquo; option to your iOS share sheet. While browsing a vendor site in Safari, tap Share → the shortcut → done.
        </p>
        <ol className="text-xs text-gray-600 space-y-1.5 list-decimal list-inside">
          <li>Open the <strong>Shortcuts</strong> app and tap <strong>+</strong> to create a new shortcut</li>
          <li>Tap <strong>Add Action</strong> → search <strong>&ldquo;URL&rdquo;</strong> → add <strong>Get URLs from Input</strong></li>
          <li>Add action: <strong>Get Contents of URL</strong> and configure:
            <ul className="mt-1 ml-4 space-y-0.5 list-disc">
              <li>URL: <code className="bg-gray-100 px-1 rounded">{importEndpoint}</code></li>
              <li>Method: <strong>POST</strong></li>
              <li>Headers: <code className="bg-gray-100 px-1 rounded">Authorization: Bearer YOUR_IMPORT_TOKEN</code></li>
              <li>Request Body: <strong>JSON</strong> → key <code className="bg-gray-100 px-1 rounded">url</code>, value: <em>URLs from previous step</em></li>
            </ul>
          </li>
          <li>Add action: <strong>Show Notification</strong> → set text to <em>Name from Get Contents result</em></li>
          <li>Tap the shortcut name → enable <strong>&ldquo;Show in Share Sheet&rdquo;</strong> → set types to <strong>URLs</strong></li>
        </ol>
        <p className="text-xs text-gray-400 mt-2">Set <code className="bg-gray-100 px-1 rounded">IMPORT_TOKEN</code> in your Railway env vars to any long random string, then paste the same value in the shortcut.</p>
      </div>

      <div className="border-t border-gray-100" />

      {/* Email forwarding */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Email forwarding (Resend)</p>
        <p className="text-xs text-gray-600 mb-3">
          Forward any vendor email — or send a message with their URL — to a dedicated address and the vendor is imported automatically.
        </p>
        <ol className="text-xs text-gray-600 space-y-1.5 list-decimal list-inside">
          <li>In Resend dashboard → <strong>Domains</strong> → your domain → <strong>Inbound Routing</strong></li>
          <li>Add rule: any email to <code className="bg-gray-100 px-1 rounded">add@yourdomain.com</code> → <strong>Webhook</strong></li>
          <li>Webhook URL: <code className="bg-gray-100 px-1 rounded">{appUrl}/api/vendors/email?secret=YOUR_INBOUND_WEBHOOK_SECRET</code></li>
          <li>Set <code className="bg-gray-100 px-1 rounded">INBOUND_WEBHOOK_SECRET</code> in Railway to match the secret in the URL</li>
          <li>Make sure <code className="bg-gray-100 px-1 rounded">IMPORT_TOKEN</code> is also set (the email route calls the import route internally)</li>
        </ol>
        <p className="text-xs text-gray-400 mt-2">Once live, forward any vendor email or send a plain message with the URL to your inbound address.</p>
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
  const [showSetup, setShowSetup] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [form, setForm] = useState({
    category: "Venue", name: "", contact: "", website: "", price: "", notes: "",
    rentalPeriod: "", overtimeRate: "",
  });

  // Per-vendor loading state for "Find similar"
  const [findingFor, setFindingFor] = useState<string | null>(null);

  // Category filter — "All" means no filter
  const [filterCategory, setFilterCategory] = useState<string>("All");

  // Venue comparison table pop-out
  const [showVenueTable, setShowVenueTable] = useState(false);

  async function handleImportUrl() {
    const url = importUrl.trim();
    if (!url) return;
    setImporting(true);
    setImportError(null);
    try {
      const res = await fetch("/api/vendors/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setImportUrl("");
      window.location.reload();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  function handleAdd() {
    if (!form.name.trim()) return;
    const isVenue = form.category === "Venue";
    addVendor({
      id:           `vendor-${Date.now()}`,
      category:     form.category,
      name:         form.name,
      contact:      form.contact      || undefined,
      website:      form.website      || undefined,
      price:        form.price        ? parseInt(form.price) : undefined,
      notes:        form.notes        || undefined,
      status:       "considering",
      rentalPeriod: isVenue ? (form.rentalPeriod || undefined) : undefined,
      overtimeRate: isVenue ? (form.overtimeRate || undefined) : undefined,
    });
    setForm({ category: "Venue", name: "", contact: "", website: "", price: "", notes: "", rentalPeriod: "", overtimeRate: "" });
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

  // Categories that actually have vendors (for filter pills)
  const presentCategories = CATEGORIES.filter((c) => vendors.some((v) => v.category === c));

  const grouped = vendors.reduce<Record<string, Vendor[]>>((acc, v) => {
    if (!acc[v.category]) acc[v.category] = [];
    acc[v.category].push(v);
    return acc;
  }, {});

  // Apply category filter
  const visibleEntries = Object.entries(grouped).filter(
    ([category]) => filterCategory === "All" || category === filterCategory
  );

  const venueVendors = grouped["Venue"] ?? [];

  return (
    <div className="space-y-6">
      {/* Venue comparison pop-out modal */}
      {showVenueTable && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowVenueTable(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Venue comparison</h2>
              <button
                onClick={() => setShowVenueTable(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M2 2l12 12M14 2L2 14" />
                </svg>
              </button>
            </div>
            <div className="overflow-x-auto p-5">
              <table className="w-full text-xs border border-gray-200 rounded-xl overflow-hidden">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-500">
                    <th className="px-3 py-2 font-medium">Venue</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Base price</th>
                    <th className="px-3 py-2 font-medium">Rental period</th>
                    <th className="px-3 py-2 font-medium">Overtime rate</th>
                  </tr>
                </thead>
                <tbody>
                  {venueVendors.map((v) => (
                    <tr key={v.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-900">{v.name}</td>
                      <td className="px-3 py-2 capitalize text-gray-600">{v.status}</td>
                      <td className="px-3 py-2 text-gray-600">{v.price ? `$${v.price.toLocaleString()}` : "—"}</td>
                      <td className="px-3 py-2 text-gray-600">{v.rentalPeriod || "—"}</td>
                      <td className="px-3 py-2 text-gray-600">{v.overtimeRate || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Vendors</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {vendors.filter((v) => v.status === "booked").length} booked &middot;{" "}
            {vendors.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          {venueVendors.length >= 2 && (
            <button
              onClick={() => setShowVenueTable(true)}
              className="px-3 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
            >
              Compare venues
            </button>
          )}
          <button
            onClick={() => setShowSetup((s) => !s)}
            className="px-3 py-2 text-xs text-gray-500 border border-gray-200 rounded-lg hover:border-gray-300 hover:text-gray-700 transition-colors"
          >
            Import setup
          </button>
          <button
            onClick={() => setAdding(true)}
            className="px-4 py-2 bg-[var(--accent)] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-colors"
          >
            Add vendor
          </button>
        </div>
      </div>

      {/* URL import bar */}
      <div className="flex gap-2">
        <input
          value={importUrl}
          onChange={(e) => { setImportUrl(e.target.value); setImportError(null); }}
          onKeyDown={(e) => e.key === "Enter" && handleImportUrl()}
          placeholder="Paste a vendor URL to import automatically..."
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
        />
        <button
          onClick={handleImportUrl}
          disabled={!importUrl.trim() || importing}
          className="px-4 py-2 bg-[var(--accent)] text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50 transition-colors shrink-0"
        >
          {importing ? (
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
              Importing…
            </span>
          ) : "Import"}
        </button>
      </div>
      {importError && (
        <p className="text-xs text-red-500">{importError}</p>
      )}

      {showSetup && <SetupPanel onClose={() => setShowSetup(false)} />}

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
            {form.category === "Venue" && (
              <>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Rental period</label>
                  <input
                    value={form.rentalPeriod}
                    onChange={(e) => setForm((f) => ({ ...f, rentalPeriod: e.target.value }))}
                    placeholder="e.g. 8 hours, full day"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Overtime rate</label>
                  <input
                    value={form.overtimeRate}
                    onChange={(e) => setForm((f) => ({ ...f, overtimeRate: e.target.value }))}
                    placeholder="e.g. $250/hour"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </>
            )}
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

      {/* Category filter pills — only shown when there are vendors */}
      {vendors.length > 0 && presentCategories.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {["All", ...presentCategories].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filterCategory === cat
                  ? "bg-[var(--accent)] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {cat}
            </button>
          ))}
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

      {visibleEntries.map(([category, catVendors]) => (
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
                    {vendor.category === "Venue" && (vendor.rentalPeriod || vendor.overtimeRate) && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {vendor.rentalPeriod && <span>{vendor.rentalPeriod}</span>}
                        {vendor.rentalPeriod && vendor.overtimeRate && <span className="mx-1 text-gray-300">&middot;</span>}
                        {vendor.overtimeRate && <span>OT: {vendor.overtimeRate}</span>}
                      </p>
                    )}
                    {vendor.notes && (
                      <p className="text-xs text-gray-400 mt-1 italic line-clamp-2">{vendor.notes}</p>
                    )}
                  </div>

                  <div
                    className="flex flex-row sm:flex-col items-center sm:items-end gap-2 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <StatusTagsSelector
                      vendor={vendor}
                      onUpdate={(updates) => updateVendor(vendor.id, updates)}
                    />

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
