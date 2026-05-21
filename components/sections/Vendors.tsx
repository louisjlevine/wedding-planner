"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePlanStore } from "@/lib/plan-store";
import type { Vendor, VendorAttachment, VendorNote, CatererPackage, BarMode, MiscLineItem } from "@/lib/types";
import { MiscLineItemsEditor } from "@/components/ui/MiscLineItemsEditor";
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

type SkippedFile = { name: string; reason: "too-large" | "failed"; size?: number };

async function processFiles(
  files: FileList,
): Promise<{ accepted: VendorAttachment[]; skipped: SkippedFile[] }> {
  const accepted: VendorAttachment[] = [];
  const skipped: SkippedFile[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.size > MAX_FILE_SIZE) {
      skipped.push({ name: file.name, reason: "too-large", size: file.size });
      continue;
    }

    try {
      const dataUrl = file.type.startsWith("image/")
        ? await resizeImage(file)
        : await new Promise<string>((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(r.result as string);
            r.onerror = () => rej(new Error(`Failed to read ${file.name}`));
            r.readAsDataURL(file);
          });
      accepted.push({
        id: `att-${Date.now()}-${i}`,
        fileName: file.name,
        mimeType: file.type,
        dataUrl,
        addedAt: new Date().toISOString(),
      });
    } catch (err) {
      skipped.push({ name: file.name, reason: "failed" });
      console.error('[processFiles] Failed to process file:', file.name, err);
    }
  }

  return { accepted, skipped };
}

function formatMb(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildSkippedMessage(skipped: SkippedFile[]): string {
  const tooLarge = skipped.filter((s) => s.reason === "too-large");
  const failed = skipped.filter((s) => s.reason === "failed");
  const parts: string[] = [];
  if (tooLarge.length > 0) {
    const names = tooLarge
      .map((s) => (s.size ? `${s.name} (${formatMb(s.size)})` : s.name))
      .join(", ");
    parts.push(
      `${tooLarge.length === 1 ? "File" : "Files"} over ${formatMb(MAX_FILE_SIZE)} can't be attached: ${names}.`,
    );
  }
  if (failed.length > 0) {
    parts.push(`Couldn't read: ${failed.map((s) => s.name).join(", ")}.`);
  }
  return parts.join(" ");
}

function AttachmentError({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div
      role="alert"
      className="mt-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
    >
      <svg
        className="w-3.5 h-3.5 mt-0.5 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m0 3v.008m9-3.758a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <p className="flex-1 leading-relaxed">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="text-red-400 hover:text-red-600 transition-colors shrink-0"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M1 1l10 10M11 1L1 11" />
        </svg>
      </button>
    </div>
  );
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
    <div className="space-y-1.5">
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
      <p className="text-[10px] text-gray-400">Max {formatMb(MAX_FILE_SIZE)} per file</p>
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
  "Venue", "Photography", "Catering", "Bar", "Florist", "Music",
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


// ── Compact status selector (for card list view) ─────────────────────────────

function StatusSelector({
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

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-2.5 h-2.5 rounded-full shrink-0 transition-all duration-150 hover:scale-125 hover:shadow-sm ${STATUS_DOT[vendor.status]}`}
        title={`Current status: ${vendor.status}. Click to change.`}
      />

      {open && (
        <div className="absolute left-0 top-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg p-3 z-50 min-w-[140px]">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Status</p>
          <div className="space-y-1.5">
            {(["considering", "contacted", "booked", "rejected"] as const).map((s) => (
              <label key={s} className="flex items-center gap-2 cursor-pointer group">
                <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[s]}`} />
                <input
                  type="radio"
                  name={`status-${vendor.id}`}
                  checked={vendor.status === s}
                  onChange={() => { onUpdate({ status: s }); setOpen(false); }}
                  className="sr-only"
                />
                <span className={`text-xs capitalize flex-1 ${vendor.status === s ? "font-semibold text-gray-900" : "text-gray-500 group-hover:text-gray-700"}`}>
                  {s}
                </span>
                {vendor.status === s && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-[var(--accent)] shrink-0">
                    <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Inline vendor edit form ───────────────────────────────────────────────────

function EditVendorForm({
  vendor,
  vendors,
  onSave,
  onCancel,
  onAutoSave,
}: {
  vendor: Vendor;
  vendors: Vendor[];
  onSave: (updates: Partial<Vendor>) => void;
  onCancel: () => void;
  onAutoSave: (updates: Partial<Vendor>) => void;
}) {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const lastSaveRef = useRef<string>('');
  // Number of file uploads currently being processed. While > 0, Save is
  // disabled and outside-clicks don't close the form, so a still-processing
  // photo isn't lost when the user taps Save or anywhere else too quickly.
  const [processing, setProcessing] = useState(0);
  const processingRef = useRef(0);
  processingRef.current = processing;
  // Migration: seed cost-detail fields from the deprecated price/rentalPeriod/
  // overtimeRate strings if structured costModel isn't set yet.
  const firstNumber = (s?: string): string => {
    if (!s) return "";
    const m = s.match(/[\d.]+/);
    return m ? m[0] : "";
  };
  const [draft, setDraft] = useState({
    name:          vendor.name,
    category:      vendor.category,
    contact:       vendor.contact       ?? "",
    website:       vendor.website       ?? "",
    status:        vendor.status,
    tags:          vendor.tags          ?? [] as string[],
    costBase:      vendor.costModel?.base?.toString()           ?? vendor.price?.toString() ?? "",
    costHours:     vendor.costModel?.hoursIncluded?.toString()  ?? firstNumber(vendor.rentalPeriod),
    costOvertime:  vendor.costModel?.overtimeHourly?.toString() ?? firstNumber(vendor.overtimeRate),
    costPerPerson: vendor.costModel?.perPerson?.toString()      ?? "",
  });
  const [packages, setPackages] = useState<CatererPackage[]>(vendor.packages ?? []);
  const [barMode, setBarMode] = useState<BarMode | "">(vendor.barMode ?? "");
  const [barSelfHostAmount, setBarSelfHostAmount] = useState<string>(
    vendor.barSelfHostAmount !== undefined ? String(vendor.barSelfHostAmount) : "",
  );
  const [barVendorId, setBarVendorId] = useState<string>(vendor.barVendorId ?? "");
  const [barCateringBase, setBarCateringBase] = useState<string>(
    vendor.barCostModel?.base !== undefined ? String(vendor.barCostModel.base) : "",
  );
  const [barCateringPerPerson, setBarCateringPerPerson] = useState<string>(
    vendor.barCostModel?.perPerson !== undefined ? String(vendor.barCostModel.perPerson) : "",
  );
  const [miscLineItems, setMiscLineItems] = useState<MiscLineItem[]>(vendor.miscLineItems ?? []);
  // Seed notesList from structured list, falling back to legacy notes string
  const [notesList, setNotesList] = useState<VendorNote[]>(() => {
    if (vendor.notesList && vendor.notesList.length > 0) return vendor.notesList;
    if (vendor.notes) return [{ id: `note-legacy-${vendor.id}`, text: vendor.notes, addedAt: vendor.id }];
    return [];
  });
  const [newNoteText, setNewNoteText] = useState("");
  const [attachments, setAttachments] = useState<VendorAttachment[]>(vendor.attachments ?? []);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  const isVenue = draft.category === "Venue";
  const isCatering = draft.category === "Catering";
  const isPerPerson = isCatering || draft.category === "Bar";

  const buildUpdates = useCallback((): Partial<Vendor> => {
    const num = (s: string) => {
      const n = parseFloat(s);
      return Number.isFinite(n) ? n : undefined;
    };
    // Strip empty packages (no name and no costs) before persisting.
    const cleanPackages = packages.filter(
      (p) => p.name.trim() || p.perPerson || p.base || p.description?.trim()
    );
    // When a caterer has packages, ignore the legacy per-person fallback —
    // package pricing is the source of truth.
    const useLegacyPerPerson = isPerPerson && !(isCatering && cleanPackages.length > 0);
    const cm = {
      base:           num(draft.costBase),
      hoursIncluded:  isVenue ? num(draft.costHours) : undefined,
      overtimeHourly: isVenue ? num(draft.costOvertime) : undefined,
      perPerson:      useLegacyPerPerson ? num(draft.costPerPerson) : undefined,
    };
    const cmHasAny = Object.values(cm).some((v) => v !== undefined);
    const cleanMisc = miscLineItems.filter((m) => Number.isFinite(m.cost));
    // Bar self-host amount only relevant when venue + self_host.
    const barSelfHostNum = isVenue && barMode === "self_host" ? num(barSelfHostAmount) : undefined;
    const barVendorIdToSave = isVenue && barMode === "via_caterer" && barVendorId ? barVendorId : undefined;
    // Caterer-only bar pricing.
    const barCm = isCatering
      ? { base: num(barCateringBase), perPerson: num(barCateringPerPerson) }
      : undefined;
    const barCmHasAny = barCm && Object.values(barCm).some((v) => v !== undefined);
    return {
      name:         draft.name.trim() || vendor.name,
      category:     draft.category,
      contact:      draft.contact      || undefined,
      website:      draft.website      || undefined,
      // Drop legacy price / rentalPeriod / overtimeRate on save — superseded by costModel.
      price:        undefined,
      rentalPeriod: undefined,
      overtimeRate: undefined,
      notes:        undefined,          // always migrate legacy notes into notesList
      notesList:    notesList.length   ? notesList : undefined,
      status:       draft.status,
      tags:         draft.tags.length  ? draft.tags : undefined,
      costModel:    cmHasAny ? cm : undefined,
      attachments:  attachments.length ? attachments : undefined,
      packages:     isCatering && cleanPackages.length ? cleanPackages : undefined,
      barMode:      isVenue && barMode ? barMode : undefined,
      barSelfHostAmount: barSelfHostNum,
      barVendorId:  barVendorIdToSave,
      barCostModel: barCmHasAny ? barCm : undefined,
      miscLineItems: cleanMisc.length ? cleanMisc : undefined,
    };
  }, [
    draft, notesList, attachments, isVenue, isCatering, isPerPerson, packages,
    barMode, barSelfHostAmount, barVendorId, barCateringBase, barCateringPerPerson,
    miscLineItems, vendor.name,
  ]);

  // Flush the draft to the store when the tab is hidden or closed — safety
  // net for mobile, where clicking "Save" may not be possible before the
  // browser discards the page.
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === "hidden") {
        const updates = buildUpdates();
        const updatesStr = JSON.stringify(updates);
        if (updatesStr === lastSaveRef.current) return;
        lastSaveRef.current = updatesStr;
        setSaveStatus('saving');
        onAutoSave(updates);
      }
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flush);
    };
  }, [buildUpdates, onAutoSave]);

  // Close-on-outside-click via pointerdown (works for both touch and mouse).
  // Deferred one frame so the click that opened the form doesn't immediately
  // close it, and uses pointer events so it fires reliably on mobile without
  // being affected by keyboard-dismissal layout shifts that previously broke
  // the mousedown approach.
  const formRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cleanup = () => {};
    const t = setTimeout(() => {
      const handler = (e: PointerEvent) => {
        if (processingRef.current > 0) return;
        if (formRef.current && !formRef.current.contains(e.target as Node)) {
          onCancel();
        }
      };
      document.addEventListener("pointerdown", handler);
      cleanup = () => document.removeEventListener("pointerdown", handler);
    }, 0);
    return () => {
      clearTimeout(t);
      cleanup();
    };
  }, [onCancel]);

  async function handleFiles(files: FileList) {
    setProcessing((n) => n + 1);
    setAttachmentError(null);
    try {
      const { accepted, skipped } = await processFiles(files);
      if (accepted.length > 0) setAttachments((prev) => [...prev, ...accepted]);
      if (skipped.length > 0) setAttachmentError(buildSkippedMessage(skipped));
    } catch (err) {
      setSaveStatus('error');
      setSaveError(err instanceof Error ? err.message : 'File upload failed');
      console.error('[Vendor] File processing failed:', err);
    } finally {
      setProcessing((n) => Math.max(0, n - 1));
    }
  }

  function commit() {
    onSave(buildUpdates());
  }

  return (
    <div ref={formRef} className="bg-[var(--accent)]/5 border border-[var(--accent)] rounded-xl px-5 py-4 space-y-3">
      <div>
        <label className="text-xs text-gray-500 mb-1.5 block">Status &amp; Tags</label>
        <div className="flex flex-wrap items-center gap-2">
          {(["considering", "contacted", "booked", "rejected"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setDraft((d) => ({ ...d, status: s }))}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                draft.status === s
                  ? "bg-[var(--accent)] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${draft.status === s ? "bg-white/80" : STATUS_DOT[s]}`} />
              <span className="capitalize">{s}</span>
            </button>
          ))}
          <span className="text-gray-300 select-none">|</span>
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
      </div>
      <div className="border-t border-gray-200/70 pt-3 space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Cost</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Base cost ($)</label>
            <input type="text" inputMode="decimal" value={draft.costBase} onChange={(e) => setDraft((d) => ({ ...d, costBase: e.target.value }))}
              placeholder={isVenue ? "Rental fee" : isPerPerson ? "Setup / minimum" : "0"}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]" />
          </div>
          {isVenue && (
            <>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Hours included</label>
                <input type="text" inputMode="decimal" value={draft.costHours} onChange={(e) => setDraft((d) => ({ ...d, costHours: e.target.value }))}
                  placeholder="e.g. 8"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Overtime $ / hour</label>
                <input type="text" inputMode="decimal" value={draft.costOvertime} onChange={(e) => setDraft((d) => ({ ...d, costOvertime: e.target.value }))}
                  placeholder="e.g. 500"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]" />
              </div>
            </>
          )}
          {isPerPerson && !isCatering && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">$ per person</label>
              <input type="text" inputMode="decimal" value={draft.costPerPerson} onChange={(e) => setDraft((d) => ({ ...d, costPerPerson: e.target.value }))}
                placeholder={draft.category === "Bar" ? "e.g. 55" : "e.g. 145"}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]" />
            </div>
          )}
          {isCatering && packages.length === 0 && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">$ per person (no packages)</label>
              <input type="text" inputMode="decimal" value={draft.costPerPerson} onChange={(e) => setDraft((d) => ({ ...d, costPerPerson: e.target.value }))}
                placeholder="e.g. 145"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]" />
            </div>
          )}
        </div>
      </div>

      {/* Catering packages */}
      {isCatering && (
        <div className="border-t border-gray-200/70 pt-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Packages</p>
            <button
              type="button"
              onClick={() => setPackages((p) => [
                ...p,
                { id: `pkg-${Date.now()}-${p.length}`, name: "", perPerson: undefined, base: undefined },
              ])}
              className="text-xs text-[var(--accent)] hover:opacity-80"
            >
              + Add package
            </button>
          </div>
          {packages.length === 0 && (
            <p className="text-[11px] text-gray-400 italic">
              Add tiered packages here so each one shows up in the Compare picker.
            </p>
          )}
          <div className="space-y-2">
            {packages.map((pkg, idx) => (
              <div key={pkg.id} className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <input
                    value={pkg.name}
                    onChange={(e) => setPackages((arr) => arr.map((p, i) => i === idx ? { ...p, name: e.target.value } : p))}
                    placeholder="Package name (e.g. Plated, Buffet, Family-style)"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--accent)]"
                  />
                  <button
                    type="button"
                    onClick={() => setPackages((arr) => arr.filter((_, i) => i !== idx))}
                    className="text-gray-300 hover:text-red-400 transition-colors shrink-0 mt-1.5"
                    aria-label="Remove package"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M1 1l10 10M11 1L1 11" />
                    </svg>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500 mb-0.5 block">$ / person</label>
                    <input
                      type="text" inputMode="decimal"
                      value={pkg.perPerson ?? ""}
                      onChange={(e) => {
                        const n = parseFloat(e.target.value);
                        setPackages((arr) => arr.map((p, i) => i === idx ? { ...p, perPerson: Number.isFinite(n) ? n : undefined } : p));
                      }}
                      placeholder="145"
                      className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 mb-0.5 block">Base / minimum ($)</label>
                    <input
                      type="text" inputMode="decimal"
                      value={pkg.base ?? ""}
                      onChange={(e) => {
                        const n = parseFloat(e.target.value);
                        setPackages((arr) => arr.map((p, i) => i === idx ? { ...p, base: Number.isFinite(n) ? n : undefined } : p));
                      }}
                      placeholder="0"
                      className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                </div>
                <input
                  value={pkg.description ?? ""}
                  onChange={(e) => setPackages((arr) => arr.map((p, i) => i === idx ? { ...p, description: e.target.value } : p))}
                  placeholder="Optional description (what's included)"
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Venue: bar-handling — mode + the amount/vendor that drives Compare */}
      {isVenue && (
        <div className="border-t border-gray-200/70 pt-3 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Bar handling</p>
          <p className="text-[11px] text-gray-400">Set how this venue handles the bar. Flows through to the Compare table.</p>
          <select
            value={barMode}
            onChange={(e) => setBarMode((e.target.value as BarMode) || "")}
            className="w-full max-w-xs border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
          >
            <option value="">— Not set —</option>
            <option value="self_host">Self-host</option>
            <option value="via_caterer">Through vendor</option>
          </select>

          {barMode === "self_host" && (
            <div className="max-w-xs">
              <label className="text-xs text-gray-500 mb-1 block">Total alcohol budget ($)</label>
              <input
                type="text" inputMode="decimal"
                value={barSelfHostAmount}
                onChange={(e) => setBarSelfHostAmount(e.target.value)}
                placeholder="e.g. 2500"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          )}

          {barMode === "via_caterer" && (() => {
            const barVendorOptions = vendors.filter(
              (v) =>
                v.id !== vendor.id &&
                v.status !== "rejected" &&
                (v.category === "Catering" || v.category === "Bar"),
            );
            return (
              <div className="max-w-xs">
                <label className="text-xs text-gray-500 mb-1 block">Bar vendor</label>
                <select
                  value={barVendorId}
                  onChange={(e) => setBarVendorId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
                >
                  <option value="">— Select caterer or bar vendor —</option>
                  {barVendorOptions.length === 0 ? (
                    <option value="" disabled>No eligible vendors yet</option>
                  ) : (
                    barVendorOptions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name?.trim() || "Untitled"} ({v.category})
                      </option>
                    ))
                  )}
                </select>
                <p className="text-[11px] text-gray-400 mt-1">
                  Pricing pulls from the selected vendor&apos;s bar costs.
                </p>
              </div>
            );
          })()}
        </div>
      )}

      {/* Caterer: optional alcohol pricing so food and bar can be compared separately */}
      {isCatering && (
        <div className="border-t border-gray-200/70 pt-3 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Alcohol / bar pricing</p>
          <p className="text-[11px] text-gray-400">
            Fill this in if this caterer also handles alcohol. Venues that pick this caterer for bar service will use these rates.
          </p>
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">$ per person</label>
              <input
                type="text" inputMode="decimal"
                value={barCateringPerPerson}
                onChange={(e) => setBarCateringPerPerson(e.target.value)}
                placeholder="e.g. 25"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Base ($)</label>
              <input
                type="text" inputMode="decimal"
                value={barCateringBase}
                onChange={(e) => setBarCateringBase(e.target.value)}
                placeholder="e.g. 500"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>
        </div>
      )}

      {/* Misc line items — shared library across all vendors */}
      <div className="border-t border-gray-200/70 pt-3">
        <MiscLineItemsEditor items={miscLineItems} onChange={setMiscLineItems} />
      </div>
      <div className="space-y-2">
        <label className="text-xs text-gray-500 block">Notes</label>
        {notesList.length > 0 && (
          <div className="space-y-1.5">
            {notesList.map((note) => (
              <div key={note.id} className="flex gap-2 items-start group bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-xs text-gray-700 flex-1 leading-relaxed">{note.text}</p>
                <button
                  type="button"
                  onClick={() => setNotesList((prev) => prev.filter((n) => n.id !== note.id))}
                  className="text-gray-300 hover:text-red-400 transition-colors shrink-0 mt-0.5 opacity-0 group-hover:opacity-100"
                  aria-label="Remove note"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M1 1l10 10M11 1L1 11" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newNoteText.trim()) {
                e.preventDefault();
                setNotesList((prev) => [...prev, { id: `note-${Date.now()}`, text: newNoteText.trim(), addedAt: new Date().toISOString() }]);
                setNewNoteText("");
              }
            }}
            placeholder="Add a note and press Enter…"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
          />
          <button
            type="button"
            disabled={!newNoteText.trim()}
            onClick={() => {
              if (!newNoteText.trim()) return;
              setNotesList((prev) => [...prev, { id: `note-${Date.now()}`, text: newNoteText.trim(), addedAt: new Date().toISOString() }]);
              setNewNoteText("");
            }}
            className="px-3 py-2 text-xs border border-gray-200 rounded-lg text-gray-500 hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40 transition-colors"
          >
            Add
          </button>
        </div>
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
        {attachmentError && (
          <AttachmentError
            message={attachmentError}
            onDismiss={() => setAttachmentError(null)}
          />
        )}
      </div>
      <div className="flex gap-2 items-center">
        <button
          type="button"
          onClick={commit}
          disabled={processing > 0}
          className="px-4 py-2 bg-[var(--accent)] text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Save
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
          Cancel
        </button>

        {/* Save status indicator */}
        <div className="flex items-center gap-1.5 text-xs">
          {processing > 0 && (
            <>
              <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-gray-500">Adding photo…</span>
            </>
          )}
          {processing === 0 && saveStatus === 'saving' && (
            <>
              <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-gray-500">Saving...</span>
            </>
          )}
          {saveStatus === 'saved' && (
            <>
              <svg className="w-3 h-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-green-600">Saved</span>
            </>
          )}
          {saveStatus === 'error' && (
            <>
              <svg className="w-3 h-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="text-red-600">Error</span>
              {saveError && (
                <span className="text-red-500 max-w-32 truncate" title={saveError}>: {saveError}</span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Setup instructions panel ──────────────────────────────────────────────────

function SetupPanel({ onClose }: { onClose: () => void }) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://your-app.com";
  const importEndpoint = `${appUrl}/api/vendors/import`;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5 text-xs">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">Import setup</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
      </div>

      {/* iOS Shortcut */}
      <div>
        <p className="font-semibold text-gray-500 uppercase tracking-wide mb-2">iOS Shortcut</p>
        <p className="text-gray-600 mb-3">
          Browse to any vendor site in Safari, tap Share → your shortcut → done. The vendor is added (or if it already exists, a new note is appended).
        </p>
        <ol className="text-gray-600 space-y-1.5 list-decimal list-inside">
          <li>Open the <strong>Shortcuts</strong> app → tap <strong>+</strong></li>
          <li><strong>Add Action</strong> → search <strong>URL</strong> → add <strong>Get URLs from Input</strong></li>
          <li>Add action <strong>Get Contents of URL</strong>:
            <ul className="mt-1 ml-4 space-y-0.5 list-disc text-gray-500">
              <li>URL: <code className="bg-gray-100 px-1 rounded">{importEndpoint}</code></li>
              <li>Method: <strong>POST</strong></li>
              <li>Header: <code className="bg-gray-100 px-1 rounded">Authorization: Bearer YOUR_IMPORT_TOKEN</code></li>
              <li>Body: <strong>JSON</strong> — key <code className="bg-gray-100 px-1 rounded">url</code>, value: <em>URL from previous step</em></li>
            </ul>
          </li>
          <li>Add <strong>Show Notification</strong> — text from the <em>name</em> field of the result</li>
          <li>Shortcut name → <strong>Show in Share Sheet</strong> → set type to <strong>URLs</strong></li>
        </ol>
        <p className="text-gray-400 mt-2">Add <code className="bg-gray-100 px-1 rounded">IMPORT_TOKEN</code> to Railway env vars (any random 32-char string), then use the same value in the shortcut.</p>
      </div>

      <div className="border-t border-gray-100" />

      {/* Email — GoDaddy subdomain + Resend */}
      <div>
        <p className="font-semibold text-gray-500 uppercase tracking-wide mb-2">Email via wedding@louisjlevine.com</p>
        <p className="text-gray-600 mb-3">
          Forward or BCC any vendor email to <strong>add@plan.louisjlevine.com</strong> and it&rsquo;s automatically imported. Only a subdomain MX record is needed — your main Titan email is completely unaffected.
        </p>

        <p className="font-medium text-gray-700 mb-1">Step 1 — WordPress.com DNS (one-time)</p>
        <ol className="text-gray-600 space-y-1 list-decimal list-inside mb-3">
          <li>WordPress.com → <strong>My Sites</strong> → <strong>Upgrades</strong> → <strong>Domains</strong> → click <em>louisjlevine.com</em></li>
          <li><strong>DNS Records</strong> → <strong>Add Record</strong> → Type: <strong>MX</strong></li>
          <li>Name/Host: <code className="bg-gray-100 px-1 rounded">plan</code> &nbsp;|&nbsp; Value: <code className="bg-gray-100 px-1 rounded">inbound.resend.com</code> &nbsp;|&nbsp; Priority: <code className="bg-gray-100 px-1 rounded">10</code> → Save</li>
        </ol>
        <p className="text-gray-400 mb-3">No email forwarding rule needed — Titan&rsquo;s forwarding only works within the same domain. Just use <code className="bg-gray-100 px-1 rounded">add@plan.louisjlevine.com</code> directly.</p>

        <p className="font-medium text-gray-700 mb-1">Step 2 — Resend inbound routing (one-time, free tier)</p>
        <ol className="text-gray-600 space-y-1 list-decimal list-inside mb-3">
          <li>resend.com → <strong>Domains</strong> → <strong>Add Domain</strong> → <code className="bg-gray-100 px-1 rounded">plan.louisjlevine.com</code></li>
          <li>Add the DNS verification records Resend shows you into GoDaddy</li>
          <li>Once verified: <strong>Inbound</strong> → <strong>Add Route</strong> → catch-all → <strong>Webhook</strong></li>
          <li>Webhook URL: <code className="bg-gray-100 px-1 rounded">{appUrl}/api/vendors/email?secret=YOUR_SECRET</code></li>
        </ol>

        <p className="font-medium text-gray-700 mb-1">Step 3 — Railway env vars</p>
        <ul className="text-gray-600 space-y-0.5 list-disc list-inside">
          <li><code className="bg-gray-100 px-1 rounded">INBOUND_WEBHOOK_SECRET</code> — the secret in the webhook URL above</li>
          <li><code className="bg-gray-100 px-1 rounded">IMPORT_TOKEN</code> — same token used by the iOS Shortcut</li>
          <li><code className="bg-gray-100 px-1 rounded">NEXT_PUBLIC_APP_URL</code> — your Railway production URL</li>
        </ul>

        <p className="text-gray-400 mt-3">Once live, forward any vendor email to <strong>wedding@louisjlevine.com</strong>. If that vendor&rsquo;s website is already in your list, the email adds a note instead of creating a duplicate.</p>
      </div>
    </div>
  );
}

// ── Main Vendors page ─────────────────────────────────────────────────────────

export function Vendors() {
  const {
    vendors, addVendor, updateVendor, removeVendor, mergeVendors,
    answers, setResearchNotes, setTriggerResearchFor, setActiveTab,
    vendorFilterHideRejected, setVendorFilterHideRejected,
    editingVendorId, setEditingVendorId,
  } = usePlanStore();

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(false);

  // Deep-link from Compare: open the requested vendor's editor, then clear
  // the trigger so the same vendor doesn't reopen on every visit.
  useEffect(() => {
    if (editingVendorId && vendors.some((v) => v.id === editingVendorId)) {
      setEditingId(editingVendorId);
      setEditingVendorId(null);
    }
  }, [editingVendorId, vendors, setEditingVendorId]);

  // Read editing/adding via refs inside the poll so toggling them doesn't
  // re-fire the effect — otherwise clicking Save would immediately fetch
  // the server snapshot (still pre-save, due to the 1.5s sync debounce)
  // and mergeVendors would clobber the freshly-saved local update.
  const editingIdRef = useRef(editingId);
  const addingRef = useRef(adding);
  editingIdRef.current = editingId;
  addingRef.current = adding;

  // Poll for externally-imported vendors (e.g. from email/shortcut).
  // Runs immediately on mount, then every 30s, but pauses during editing to prevent conflicts.
  useEffect(() => {
    async function pollVendors() {
      if (editingIdRef.current || addingRef.current) return;

      try {
        const res = await fetch("/api/sync");
        if (!res.ok) return;
        const data = await res.json() as { vendors?: unknown[] };
        if (Array.isArray(data.vendors) && data.vendors.length > 0) {
          mergeVendors(data.vendors as import("@/lib/types").Vendor[]);
        }
      } catch {
        // silent — polling is best-effort
      }
    }
    pollVendors(); // immediate on mount
    const id = setInterval(pollVendors, 30_000);
    return () => clearInterval(id);
  }, [mergeVendors]);
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [form, setForm] = useState({
    category: "Venue", name: "", contact: "", website: "", notes: "",
    costBase: "", costHours: "", costOvertime: "", costPerPerson: "",
  });
  const [addFormAttachments, setAddFormAttachments] = useState<VendorAttachment[]>([]);
  const [addFormAttachmentError, setAddFormAttachmentError] = useState<string | null>(null);

  // Per-vendor loading state for "Find similar"
  const [findingFor, setFindingFor] = useState<string | null>(null);

  // Category filter — "All" means no filter
  const [filterCategory, setFilterCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");

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
      // Soft reload - refetch data instead of hard reload
      try {
        const syncRes = await fetch("/api/sync");
        if (syncRes.ok) {
          const syncData = await syncRes.json() as { vendors?: unknown[] };
          if (Array.isArray(syncData.vendors)) {
            mergeVendors(syncData.vendors as import("@/lib/types").Vendor[]);
          }
        }
      } catch {
        // Fall back to hard reload if sync fails
        window.location.reload();
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  function handleAdd() {
    if (!form.name.trim()) return;
    
    try {
      const isVenue = form.category === "Venue";
      const isPerPerson = form.category === "Catering" || form.category === "Bar";
      const num = (s: string) => {
        const n = parseFloat(s);
        return Number.isFinite(n) ? n : undefined;
      };
      const cm: Vendor["costModel"] = {
        base:           num(form.costBase),
        hoursIncluded:  isVenue ? num(form.costHours) : undefined,
        overtimeHourly: isVenue ? num(form.costOvertime) : undefined,
        perPerson:      isPerPerson ? num(form.costPerPerson) : undefined,
      };
      const cmHasAny = Object.values(cm).some((v) => v !== undefined);
      addVendor({
        id:           `vendor-${Date.now()}`,
        category:     form.category,
        name:         form.name,
        contact:      form.contact      || undefined,
        website:      form.website      || undefined,
        notes:        form.notes        || undefined,
        status:       "considering",
        costModel:    cmHasAny ? cm : undefined,
        attachments:  addFormAttachments.length ? addFormAttachments : undefined,
      });
      setForm({ category: "Venue", name: "", contact: "", website: "", notes: "", costBase: "", costHours: "", costOvertime: "", costPerPerson: "" });
      setAddFormAttachments([]);
      setAdding(false);
    } catch (err) {
      console.error('[Vendor] Failed to add vendor:', err);
      // Could show an error message to user here in the future
    }
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

  const filteredVendors = vendors
    .filter((v) => !vendorFilterHideRejected || v.status !== "rejected")
    .filter((v) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        v.name.toLowerCase().includes(q) ||
        v.website?.toLowerCase().includes(q) ||
        v.notes?.toLowerCase().includes(q) ||
        v.contact?.toLowerCase().includes(q)
      );
    });

  const grouped = filteredVendors.reduce<Record<string, Vendor[]>>((acc, v) => {
    if (!acc[v.category]) acc[v.category] = [];
    acc[v.category].push(v);
    return acc;
  }, {});
  Object.values(grouped).forEach((g) => g.sort((a, b) => a.name.localeCompare(b.name)));

  // Apply category filter
  const visibleEntries = Object.entries(grouped).filter(
    ([category]) => filterCategory === "All" || category === filterCategory
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Vendors</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {vendors.filter((v) => v.status === "booked").length} booked &middot;{" "}
            {vendors.length} total
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
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
              <label className="text-xs text-gray-500 mb-1 block">Notes</label>
              <input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Any notes..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Base cost ($)</label>
              <input
                type="text" inputMode="decimal"
                value={form.costBase}
                onChange={(e) => setForm((f) => ({ ...f, costBase: e.target.value }))}
                placeholder="0"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            {form.category === "Venue" && (
              <>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Hours included</label>
                  <input
                    type="text" inputMode="decimal"
                    value={form.costHours}
                    onChange={(e) => setForm((f) => ({ ...f, costHours: e.target.value }))}
                    placeholder="e.g. 8"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Overtime $ / hour</label>
                  <input
                    type="text" inputMode="decimal"
                    value={form.costOvertime}
                    onChange={(e) => setForm((f) => ({ ...f, costOvertime: e.target.value }))}
                    placeholder="e.g. 500"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </>
            )}
            {(form.category === "Catering" || form.category === "Bar") && (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">$ per person</label>
                <input
                  type="text" inputMode="decimal"
                  value={form.costPerPerson}
                  onChange={(e) => setForm((f) => ({ ...f, costPerPerson: e.target.value }))}
                  placeholder={form.category === "Bar" ? "e.g. 55" : "e.g. 145"}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
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
                setAddFormAttachmentError(null);
                const { accepted, skipped } = await processFiles(files);
                if (accepted.length > 0) setAddFormAttachments((prev) => [...prev, ...accepted]);
                if (skipped.length > 0) setAddFormAttachmentError(buildSkippedMessage(skipped));
              }} />
            </div>
            {addFormAttachmentError && (
              <AttachmentError
                message={addFormAttachmentError}
                onDismiss={() => setAddFormAttachmentError(null)}
              />
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

      {/* Search + filter row — only shown when there are vendors */}
      {vendors.length > 0 && (
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
          </svg>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search vendors…"
            className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M2 2l10 10M12 2L2 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Category filter pills — only shown when there are vendors */}
      {vendors.length > 0 && (presentCategories.length > 1 || vendors.some((v) => v.status === "rejected")) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {presentCategories.length > 1 && ["All", ...presentCategories].map((cat) => (
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
          {vendors.some((v) => v.status === "rejected") && (
            <button
              onClick={() => setVendorFilterHideRejected(!vendorFilterHideRejected)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                vendorFilterHideRejected
                  ? "bg-gray-800 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {vendorFilterHideRejected ? "Show rejected" : "Hide rejected"}
            </button>
          )}
        </div>
      )}

      {vendors.length > 0 && filteredVendors.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-6">No vendors match your search.</p>
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
                    vendors={vendors}
                    onSave={(updates) => { updateVendor(vendor.id, updates); setEditingId(null); }}
                    onCancel={() => setEditingId(null)}
                    onAutoSave={(updates) => updateVendor(vendor.id, updates)}
                  />
                );
              }

              return (
                <div
                  key={vendor.id}
                  onClick={() => setEditingId(vendor.id)}
                  className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between gap-4 cursor-pointer hover:border-[var(--accent)]/50 hover:shadow-sm transition-[border-color,box-shadow] duration-150"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <StatusSelector
                      vendor={vendor}
                      onUpdate={(updates) => updateVendor(vendor.id, updates)}
                    />
                    <p className="text-sm font-medium text-gray-900 truncate flex-1 min-w-0">
                      {vendor.name?.trim() || <span className="italic text-gray-400">Untitled vendor</span>}
                    </p>
                    {vendor.tags && vendor.tags.length > 0 && (
                      <div className="flex items-center gap-1 shrink-0">
                        {vendor.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 whitespace-nowrap"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {vendor.website && (
                      <a
                        href={/^https?:\/\//i.test(vendor.website) ? vendor.website : `https://${vendor.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title={vendor.website}
                        aria-label={`Open ${vendor.name} website`}
                        className="inline-flex items-center text-gray-400 hover:text-[var(--accent)] transition-colors shrink-0"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                      </a>
                    )}
                  </div>

                  <div
                    className="flex items-center gap-2 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {canFindSimilar && (
                      <button
                        onClick={() => handleFindSimilar(vendor)}
                        disabled={isLoading}
                        className="inline-flex items-center gap-1.5 text-xs text-gray-400 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50 transition-colors"
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
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeVendor(vendor.id);
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5 hover:bg-red-100 hover:border-red-300 transition-colors"
                    >
                      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9a1 1 0 001 1h6a1 1 0 001-1l1-9" />
                      </svg>
                      Remove
                    </button>
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
