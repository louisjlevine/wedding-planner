"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePlanStore } from "@/lib/plan-store";
import type { Vendor, VendorAttachment } from "@/lib/types";
import type { ResearchType } from "@/lib/research-prompts";

// ── Attachment helpers ───────────────────────────────────────────────────────

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_IMAGE_DIMENSION = 1200;

function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (!file.type.startsWith("image/")) {
        resolve(reader.result as string);
        return;
      }
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width <= MAX_IMAGE_DIMENSION && height <= MAX_IMAGE_DIMENSION) {
          resolve(reader.result as string);
          return;
        }
        const ratio = Math.min(MAX_IMAGE_DIMENSION / width, MAX_IMAGE_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL(file.type, 0.85));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function processFiles(files: FileList): Promise<VendorAttachment[]> {
  const results: VendorAttachment[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.size > MAX_FILE_SIZE) continue;
    const dataUrl = file.type.startsWith("image/")
      ? await resizeImage(file)
      : await new Promise<string>((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result as string);
          r.onerror = rej;
          r.readAsDataURL(file);
        });
    results.push({
      id: `att-${Date.now()}-${i}`,
      fileName: file.name,
      mimeType: file.type,
      dataUrl,
      addedAt: new Date().toISOString(),
    });
  }
  return results;
}

// ── Attachment list component ────────────────────────────────────────────────

function AttachmentList({
  attachments,
  onRemove,
}: {
  attachments: VendorAttachment[];
  onRemove?: (id: string) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);

  if (attachments.length === 0) return null;

  return (
    <>
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setPreview(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Preview" className="max-w-full max-h-[80vh] rounded-xl shadow-2xl" />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {attachments.map((att) => {
          const isImage = att.mimeType.startsWith("image/");
          return (
            <div key={att.id} className="relative group">
              {isImage ? (
                <button type="button" onClick={() => setPreview(att.dataUrl)} className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={att.dataUrl}
                    alt={att.fileName}
                    className="w-16 h-16 object-cover rounded-lg border border-gray-200 hover:border-[var(--accent)] transition-colors"
                  />
                </button>
              ) : (
                <div className="w-16 h-16 rounded-lg border border-gray-200 flex flex-col items-center justify-center bg-gray-50 px-1">
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <span className="text-[9px] text-gray-400 truncate w-full text-center mt-0.5">{att.fileName}</span>
                </div>
              )}
              {onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(att.id)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  x
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── File upload button ───────────────────────────────────────────────────────

function AttachmentUpload({
  onFiles,
}: {
  onFiles: (files: FileList) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex gap-2">
      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx,.txt"
        capture={undefined}
        onChange={(e) => { if (e.target.files?.length) onFiles(e.target.files); e.target.value = ""; }}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="inline-flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
        </svg>
        Attach file
      </button>
      <button
        type="button"
        onClick={() => {
          // Create a separate input with capture="environment" for camera
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "image/*";
          input.capture = "environment";
          input.onchange = () => { if (input.files?.length) onFiles(input.files); };
          input.click();
        }}
        className="inline-flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
        </svg>
        Photo
      </button>
    </div>
  );
}

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
        className={`flex items-center gap-1.5 text-xs border rounded-lg px-2.5 py-1.5 transition-colors ${
          open ? "border-[var(--accent)] text-gray-900" : "border-gray-200 hover:border-[var(--accent)]"
        }`}
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[vendor.status]}`} />
        <span className="capitalize">{vendor.status}</span>
        {tags.length === 1 && (
          <span className="text-gray-400 font-normal">· {tags[0]}</span>
        )}
        {tags.length > 1 && (
          <>
            <span className="text-gray-400 font-normal">· {tags[0]}</span>
            <span className="text-[10px] font-semibold text-white bg-[var(--accent)] rounded-full px-1.5 py-0.5 leading-none">
              +{tags.length - 1}
            </span>
          </>
        )}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-gray-400 ml-0.5">
          <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-2 z-20 min-w-[180px]">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-3 mb-1">Status</p>
          {(["considering", "contacted", "booked", "rejected"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onUpdate({ status: s })}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors ${
                vendor.status === s
                  ? "bg-[var(--accent)]/8 text-[var(--accent)]"
                  : "hover:bg-gray-50 text-gray-600"
              }`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[s]}`} />
              <span className="text-xs capitalize font-medium flex-1">{s}</span>
              {vendor.status === s && (
                <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
                </svg>
              )}
            </button>
          ))}

          <div className="border-t border-gray-100 my-2" />
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-3 mb-1">Tags</p>
          {TAGS.map((tag) => {
            const active = tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  const newTags = active
                    ? tags.filter((t) => t !== tag)
                    : [...tags, tag];
                  onUpdate({ tags: newTags });
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors ${
                  active
                    ? "bg-[var(--accent)]/8 text-[var(--accent)]"
                    : "hover:bg-gray-50 text-gray-600"
                }`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${active ? "bg-[var(--accent)]" : "bg-gray-200"}`} />
                <span className="text-xs font-medium flex-1">{tag}</span>
                {active && (
                  <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
                  </svg>
                )}
              </button>
            );
          })}
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
  const [attachments, setAttachments] = useState<VendorAttachment[]>(vendor.attachments ?? []);
  const [cleaningUp, setCleaningUp] = useState(false);

  const isVenue = draft.category === "Venue";

  const handleCleanupNotes = useCallback(async () => {
    if (!draft.notes.trim() || cleaningUp) return;
    setCleaningUp(true);
    try {
      const res = await fetch("/api/vendors/cleanup-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: draft.notes, vendorName: draft.name, category: draft.category }),
      });
      if (!res.ok) throw new Error();
      const { cleaned } = await res.json();
      if (cleaned) setDraft((d) => ({ ...d, notes: cleaned }));
    } catch {
      // silently fail — user still has original notes
    } finally {
      setCleaningUp(false);
    }
  }, [draft.notes, draft.name, draft.category, cleaningUp]);

  async function handleFiles(files: FileList) {
    const newAtts = await processFiles(files);
    setAttachments((prev) => [...prev, ...newAtts]);
  }

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
      attachments:  attachments.length ? attachments : undefined,
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
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-gray-500">Notes</label>
          {draft.notes.trim() && (
            <button
              type="button"
              onClick={handleCleanupNotes}
              disabled={cleaningUp}
              className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-[var(--accent)] disabled:opacity-50 transition-colors"
            >
              {cleaningUp ? (
                <>
                  <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                  Cleaning up…
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                  </svg>
                  Clean up
                </>
              )}
            </button>
          )}
        </div>
        <textarea value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
          rows={3} placeholder="Any notes..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)] resize-none" />
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1.5 block">Attachments</label>
        <AttachmentList
          attachments={attachments}
          onRemove={(id) => setAttachments((prev) => prev.filter((a) => a.id !== id))}
        />
        <div className="mt-2">
          <AttachmentUpload onFiles={handleFiles} />
        </div>
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
  const [addFormAttachments, setAddFormAttachments] = useState<VendorAttachment[]>([]);

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
      attachments:  addFormAttachments.length ? addFormAttachments : undefined,
    });
    setForm({ category: "Venue", name: "", contact: "", website: "", price: "", notes: "", rentalPeriod: "", overtimeRate: "" });
    setAddFormAttachments([]);
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

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Vendors</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {vendors.filter((v) => v.status === "booked").length} booked &middot;{" "}
            {vendors.length} total
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
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
          className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
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
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Attachments</label>
            <AttachmentList
              attachments={addFormAttachments}
              onRemove={(id) => setAddFormAttachments((prev) => prev.filter((a) => a.id !== id))}
            />
            <div className="mt-2">
              <AttachmentUpload onFiles={async (files) => {
                const newAtts = await processFiles(files);
                setAddFormAttachments((prev) => [...prev, ...newAtts]);
              }} />
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
                    {vendor.attachments && vendor.attachments.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {vendor.attachments.slice(0, 4).map((att) => (
                          att.mimeType.startsWith("image/") ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={att.id} src={att.dataUrl} alt={att.fileName}
                              className="w-8 h-8 object-cover rounded border border-gray-200" />
                          ) : (
                            <div key={att.id} className="w-8 h-8 rounded border border-gray-200 bg-gray-50 flex items-center justify-center">
                              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                              </svg>
                            </div>
                          )
                        ))}
                        {vendor.attachments.length > 4 && (
                          <span className="text-[10px] text-gray-400">+{vendor.attachments.length - 4}</span>
                        )}
                      </div>
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
