"use client";

import { useState, useRef } from "react";
import { usePlanStore } from "@/lib/plan-store";
import { Badge } from "@/components/ui/Badge";
import {
  getBaseProbability,
  guestExpectedCount,
  estimatedAttendance,
  RELATIONSHIP_LABELS,
  LOCATION_LABELS,
} from "@/lib/guest-probability";
import type ExcelJS from "exceljs";
import type { Guest, GuestRelationship, GuestLocation, GuestSide } from "@/lib/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const RSVP_VARIANTS: Record<Guest["rsvp"], "green" | "red" | "yellow" | "gray"> = {
  yes: "green", no: "red", maybe: "yellow", pending: "gray",
};

const RELATIONSHIPS: GuestRelationship[] = ["family", "close_friend", "friend", "acquaintance"];
const LOCATIONS: GuestLocation[] = ["local", "out_of_town"];
const SIDES: GuestSide[] = ["bride", "groom", "both"];
const SIDE_LABELS: Record<GuestSide, string> = { bride: "Bride's side", groom: "Groom's side", both: "Both sides" };

// ── Excel helpers ─────────────────────────────────────────────────────────────

const XLSX_COLUMNS = [
  { header: "Name",         key: "name",        width: 25 },
  { header: "Email",        key: "email",       width: 30 },
  { header: "Phone",        key: "phone",       width: 15 },
  { header: "Address",      key: "address",     width: 35 },
  { header: "Relationship", key: "relationship",width: 18 },
  { header: "Location",     key: "location",    width: 15 },
  { header: "Side",         key: "side",        width: 15 },
  { header: "Total Guests", key: "totalGuests", width: 13 },
  { header: "Dietary",      key: "dietary",     width: 20 },
  { header: "Table",        key: "table",       width: 12 },
  { header: "RSVP",         key: "rsvp",        width: 12 },
  { header: "Notes",        key: "notes",       width: 30 },
];

// Column letters for dropdown columns (1-indexed: A=1)
const COL = { relationship: "E", location: "F", side: "G", rsvp: "K" };

async function buildXLSX(rows: Record<string, string | number>[]) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Guests");

  ws.columns = XLSX_COLUMNS as ExcelJS.Column[];

  // Style header row
  ws.getRow(1).eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD4537E" } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
  });

  for (const row of rows) ws.addRow(row);

  // Add dropdown validation for rows 2–200
  for (let r = 2; r <= 200; r++) {
    ws.getCell(`${COL.relationship}${r}`).dataValidation = {
      type: "list", allowBlank: true,
      formulae: ['"Family,Close friend,Friend,Acquaintance"'],
      showErrorMessage: false,
    };
    ws.getCell(`${COL.location}${r}`).dataValidation = {
      type: "list", allowBlank: true,
      formulae: ['"Local,Out of town"'],
      showErrorMessage: false,
    };
    ws.getCell(`${COL.side}${r}`).dataValidation = {
      type: "list", allowBlank: true,
      formulae: ['"Bride\'s side,Groom\'s side,Both sides"'],
      showErrorMessage: false,
    };
    ws.getCell(`${COL.rsvp}${r}`).dataValidation = {
      type: "list", allowBlank: true,
      formulae: ['"pending,yes,no,maybe"'],
      showErrorMessage: false,
    };
  }

  return wb.xlsx.writeBuffer();
}

function triggerDownload(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadXLSXTemplate() {
  const buffer = await buildXLSX([{
    name: "Jane Smith", email: "jane@example.com", phone: "555-0100",
    address: "123 Main St, Denver CO 80202", relationship: "Family",
    location: "Local", side: "Bride's side", totalGuests: 1,
    dietary: "vegetarian", table: "Table 1", rsvp: "pending", notes: "Childhood friend",
  }]);
  triggerDownload(buffer as ArrayBuffer, "guest-list-template.xlsx");
}

export async function exportGuestsXLSX(guests: Guest[]) {
  const rows = guests.map((g) => ({
    name:         g.name,
    email:        g.email         ?? "",
    phone:        "",
    address:      g.address       ?? "",
    relationship: g.relationship  ? RELATIONSHIP_LABELS[g.relationship] : "",
    location:     g.guestLocation ? LOCATION_LABELS[g.guestLocation]   : "",
    side:         g.side          ? SIDE_LABELS[g.side]                 : "",
    totalGuests:  g.totalGuests,
    dietary:      g.dietary ?? "",
    table:        g.table   ?? "",
    rsvp:         g.rsvp,
    notes:        "",
  }));
  const buffer = await buildXLSX(rows);
  triggerDownload(buffer as ArrayBuffer, "guest-list.xlsx");
}

// ── XLSX import helper ────────────────────────────────────────────────────────

async function parseXLSX(buffer: ArrayBuffer): Promise<Partial<Guest>[]> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];

  // Build reverse lookup maps from label → internal value
  const REL_REV: Record<string, GuestRelationship> = Object.fromEntries(
    Object.entries(RELATIONSHIP_LABELS).map(([k, v]) => [v.toLowerCase(), k as GuestRelationship])
  );
  const LOC_REV: Record<string, GuestLocation> = Object.fromEntries(
    Object.entries(LOCATION_LABELS).map(([k, v]) => [v.toLowerCase(), k as GuestLocation])
  );
  const SIDE_REV: Record<string, GuestSide> = Object.fromEntries(
    Object.entries(SIDE_LABELS).map(([k, v]) => [v.toLowerCase(), k as GuestSide])
  );

  // Read header row to map column index → field name
  const headerRow = ws.getRow(1);
  const colMap: Record<number, string> = {};
  headerRow.eachCell((cell, colNum) => {
    colMap[colNum] = String(cell.value ?? "").trim().toLowerCase().replace(/\s+/g, "");
  });

  const results: Partial<Guest>[] = [];
  ws.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    const get = (key: string): string => {
      const aliases: Record<string, string[]> = {
        name:         ["name", "fullname"],
        email:        ["email", "emailaddress"],
        address:      ["address", "addr"],
        relationship: ["relationship", "relation"],
        location:     ["location", "guestlocation"],
        side:         ["side", "familyside"],
        totalguests:  ["totalguests", "total_guests", "plusone"],
        dietary:      ["dietary", "diet"],
        table:        ["table", "tablenumber"],
        rsvp:         ["rsvp"],
        notes:        ["notes"],
      };
      for (const alias of (aliases[key] ?? [key])) {
        const colNum = Object.entries(colMap).find(([, v]) => v === alias)?.[0];
        if (colNum) {
          const val = row.getCell(Number(colNum)).value;
          return val == null ? "" : String(val).trim();
        }
      }
      return "";
    };

    const name = get("name");
    if (!name) return;

    const relRaw = get("relationship").toLowerCase();
    const locRaw = get("location").toLowerCase();
    const sideRaw = get("side").toLowerCase();
    const rsvpRaw = get("rsvp").toLowerCase();

    results.push({
      name,
      email:        get("email")   || undefined,
      address:      get("address") || undefined,
      dietary:      get("dietary") || undefined,
      table:        get("table")   || undefined,
      totalGuests:  Math.max(1, parseInt(get("totalguests"), 10) || 1),
      relationship: REL_REV[relRaw]  ?? (relRaw.startsWith("fam") ? "family" : relRaw.includes("close") ? "close_friend" : relRaw.startsWith("friend") ? "friend" : relRaw.startsWith("acq") ? "acquaintance" : undefined),
      guestLocation: LOC_REV[locRaw] ?? (locRaw.startsWith("local") ? "local" : locRaw.includes("out") ? "out_of_town" : undefined),
      side:          SIDE_REV[sideRaw] ?? (sideRaw.startsWith("bride") ? "bride" : sideRaw.startsWith("groom") ? "groom" : sideRaw === "both" ? "both" : undefined),
      rsvp:         (["yes","no","maybe","pending"].includes(rsvpRaw) ? rsvpRaw as Guest["rsvp"] : "pending"),
    });
  });
  return results;
}

// ── CSV / vCard import helpers ────────────────────────────────────────────────

function parseCSV(text: string): Partial<Guest>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/[^a-z_]/g, ""));

  function col(row: string[], name: string): string {
    const aliases: Record<string, string[]> = {
      name:         ["name", "fullname", "full_name", "guestname"],
      email:        ["email", "emailaddress"],
      address:      ["address", "addr", "mailing"],
      relationship: ["relationship", "relation", "type"],
      guestlocation:["location", "guestlocation", "city"],
      side:         ["side", "family_side", "familyside"],
      totalguests:  ["totalguests", "total_guests", "plusone", "plus_one", "guest"],
      dietary:      ["dietary", "diet", "food"],
      table:        ["table", "tablenumber", "seat"],
    };
    const keys = aliases[name] ?? [name];
    for (const k of keys) {
      const i = headers.indexOf(k);
      if (i !== -1 && row[i] !== undefined) return row[i].trim().replace(/^"|"$/g, "");
    }
    return "";
  }

  return lines.slice(1).map((line) => {
    const row = line.split(",");
    const name = col(row, "name");
    if (!name) return null;
    const relRaw = col(row, "relationship").toLowerCase();
    const locRaw = col(row, "guestlocation").toLowerCase();
    const rel: GuestRelationship | undefined =
      relRaw.startsWith("fam") ? "family"
      : relRaw.includes("close") ? "close_friend"
      : relRaw.startsWith("friend") || relRaw === "fri" ? "friend"
      : relRaw.startsWith("acq") ? "acquaintance"
      : undefined;
    const loc: GuestLocation | undefined =
      locRaw.startsWith("local") || locRaw === "denver" || locRaw === "in town" ? "local"
      : locRaw.includes("out") || locRaw === "remote" || locRaw === "travel" ? "out_of_town"
      : undefined;
    const sideRaw = col(row, "side").toLowerCase();
    const side: GuestSide | undefined =
      sideRaw.startsWith("bride") ? "bride"
      : sideRaw.startsWith("groom") ? "groom"
      : sideRaw === "both" || sideRaw === "shared" ? "both"
      : undefined;
    return {
      name,
      email:        col(row, "email")   || undefined,
      address:      col(row, "address") || undefined,
      dietary:      col(row, "dietary") || undefined,
      table:        col(row, "table")   || undefined,
      totalGuests:  Math.max(1, parseInt(col(row, "totalguests"), 10) || (["yes","true","1","x"].includes(col(row, "totalguests").toLowerCase()) ? 2 : 1)),
      relationship: rel,
      guestLocation: loc,
      side,
      rsvp: "pending" as const,
    };
  }).filter(Boolean) as Partial<Guest>[];
}

function parseVCard(text: string): Partial<Guest>[] {
  const cards = text.split(/BEGIN:VCARD/i).slice(1);
  return cards.map((card) => {
    const get = (key: string) => {
      const match = card.match(new RegExp(`^${key}[^:]*:(.+)$`, "mi"));
      return match ? match[1].trim() : "";
    };
    const name = get("FN") || get("N").replace(/;/g, " ").trim();
    if (!name) return null;
    const adrRaw = get("ADR");
    const address = adrRaw ? adrRaw.replace(/;+/g, ", ").replace(/^,\s*/, "").trim() : undefined;
    return {
      name,
      email:   get("EMAIL") || undefined,
      address: address       || undefined,
      totalGuests: 1,
      rsvp: "pending" as const,
    };
  }).filter(Boolean) as Partial<Guest>[];
}

// ── Side-split helpers ────────────────────────────────────────────────────────

type SideSplit = Record<"bride" | "groom" | "both" | "unknown", number>;

function sideSplitCount(gs: Guest[]): SideSplit {
  return {
    bride:   gs.filter((g) => g.side === "bride").reduce((s, g) => s + g.totalGuests, 0),
    groom:   gs.filter((g) => g.side === "groom").reduce((s, g) => s + g.totalGuests, 0),
    both:    gs.filter((g) => g.side === "both").reduce((s, g) => s + g.totalGuests, 0),
    unknown: gs.filter((g) => !g.side).reduce((s, g) => s + g.totalGuests, 0),
  };
}

function sideSplitEstimated(gs: Guest[]): SideSplit {
  return {
    bride:   Math.round(gs.filter((g) => g.side === "bride").reduce((s, g) => s + guestExpectedCount(g), 0)),
    groom:   Math.round(gs.filter((g) => g.side === "groom").reduce((s, g) => s + guestExpectedCount(g), 0)),
    both:    Math.round(gs.filter((g) => g.side === "both").reduce((s, g) => s + guestExpectedCount(g), 0)),
    unknown: Math.round(gs.filter((g) => !g.side).reduce((s, g) => s + guestExpectedCount(g), 0)),
  };
}

function SideTooltip({ split }: { split: SideSplit }) {
  const rows: [string, number][] = [
    ["Bride's side", split.bride],
    ["Groom's side", split.groom],
    ["Both sides",   split.both],
    ["Unknown",      split.unknown],
  ];
  const hasAny = rows.some(([, v]) => v > 0);
  if (!hasAny) return null;
  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 z-50 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl whitespace-nowrap pointer-events-none">
      <div className="space-y-1">
        {rows.map(([label, val]) => (
          <div key={label} className="flex items-center justify-between gap-4">
            <span className="text-gray-300">{label}</span>
            <span className="font-semibold tabular-nums">{val}</span>
          </div>
        ))}
      </div>
      {/* Down-pointing arrow */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
    </div>
  );
}

// ── Inline edit form ──────────────────────────────────────────────────────────

function EditGuestForm({
  guest,
  onSave,
  onCancel,
}: {
  guest: Guest;
  onSave: (u: Partial<Guest>) => void;
  onCancel: () => void;
}) {
  const [d, setD] = useState({
    name:          guest.name,
    email:         guest.email         ?? "",
    address:       guest.address       ?? "",
    relationship:  guest.relationship  ?? ("" as GuestRelationship | ""),
    guestLocation: guest.guestLocation ?? ("" as GuestLocation | ""),
    side:          guest.side          ?? ("" as GuestSide | ""),
    totalGuests:   String(guest.totalGuests ?? 1),
    dietary:       guest.dietary ?? "",
    table:         guest.table   ?? "",
    rsvp:          guest.rsvp,
  });

  return (
    <div className="bg-[var(--accent)]/5 border border-[var(--accent)] rounded-xl px-5 py-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Name</label>
          <input value={d.name} onChange={(e) => setD((x) => ({ ...x, name: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Email</label>
          <input type="email" value={d.email} onChange={(e) => setD((x) => ({ ...x, email: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Relationship</label>
          <select value={d.relationship} onChange={(e) => setD((x) => ({ ...x, relationship: e.target.value as GuestRelationship }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]">
            <option value="">— unset —</option>
            {RELATIONSHIPS.map((r) => <option key={r} value={r}>{RELATIONSHIP_LABELS[r]}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Location</label>
          <select value={d.guestLocation} onChange={(e) => setD((x) => ({ ...x, guestLocation: e.target.value as GuestLocation }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]">
            <option value="">— unset —</option>
            {LOCATIONS.map((l) => <option key={l} value={l}>{LOCATION_LABELS[l]}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Side of family</label>
          <select value={d.side} onChange={(e) => setD((x) => ({ ...x, side: e.target.value as GuestSide }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]">
            <option value="">— unset —</option>
            {SIDES.map((s) => <option key={s} value={s}>{SIDE_LABELS[s]}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">RSVP</label>
          <select value={d.rsvp} onChange={(e) => setD((x) => ({ ...x, rsvp: e.target.value as Guest["rsvp"] }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]">
            <option value="pending">Pending</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
            <option value="maybe">Maybe</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Table</label>
          <input value={d.table} onChange={(e) => setD((x) => ({ ...x, table: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Dietary</label>
          <input value={d.dietary} onChange={(e) => setD((x) => ({ ...x, dietary: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]" />
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Address</label>
        <input value={d.address} onChange={(e) => setD((x) => ({ ...x, address: e.target.value }))}
          placeholder="123 Main St, Denver CO 80202"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]" />
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Total guests</label>
        <input type="number" min={1} max={20} inputMode="numeric" value={d.totalGuests}
          onChange={(e) => setD((x) => ({ ...x, totalGuests: e.target.value }))}
          className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]" />
      </div>
      <div className="flex gap-2">
        <button onClick={() => onSave({
          name:          d.name.trim() || guest.name,
          email:         d.email    || undefined,
          address:       d.address  || undefined,
          relationship:  d.relationship  || undefined,
          guestLocation: d.guestLocation || undefined,
          side:          d.side          || undefined,
          totalGuests:   Math.min(20, Math.max(1, parseInt(d.totalGuests, 10) || 1)),
          dietary:       d.dietary  || undefined,
          table:         d.table    || undefined,
          rsvp:          d.rsvp,
        })}
          className="px-4 py-2 bg-[var(--accent)] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-colors">
          Save
        </button>
        <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
      </div>
    </div>
  );
}

// ── Main Guests page ──────────────────────────────────────────────────────────

export function Guests() {
  const { guests, addGuest, updateGuest, removeGuest } = usePlanStore();

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sideFilter, setSideFilter] = useState<GuestSide | "all">("all");
  const [locationFilter, setLocationFilter] = useState<GuestLocation | "all">("all");
  const [form, setForm] = useState({
    name: "", email: "", address: "", totalGuests: "1", dietary: "", table: "",
    relationship: "" as GuestRelationship | "",
    guestLocation: "" as GuestLocation | "",
    side: "" as GuestSide | "",
  });

  const csvInputRef  = useRef<HTMLInputElement>(null);
  const vcfInputRef  = useRef<HTMLInputElement>(null);

  const [csvPreview,  setCsvPreview]  = useState<Partial<Guest>[] | null>(null);
  const [csvWarnings, setCsvWarnings] = useState<string[]>([]);

  // ── Add single guest ─────────────────────────────────────────────────────

  function handleAdd() {
    if (!form.name.trim()) return;
    addGuest({
      id:            `guest-${Date.now()}`,
      name:          form.name,
      email:         form.email         || undefined,
      address:       form.address       || undefined,
      totalGuests:   Math.min(20, Math.max(1, parseInt(form.totalGuests, 10) || 1)),
      rsvp:          "pending",
      dietary:       form.dietary       || undefined,
      table:         form.table         || undefined,
      relationship:  form.relationship  || undefined,
      guestLocation: form.guestLocation || undefined,
      side:          form.side          || undefined,
    });
    setForm({ name: "", email: "", address: "", totalGuests: "1", dietary: "", table: "", relationship: "", guestLocation: "", side: "" });
    setAdding(false);
  }

  // ── CSV / XLSX import — parse then preview ───────────────────────────────

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const isXlsx = file.name.toLowerCase().endsWith(".xlsx");

    const finish = (parsed: Partial<Guest>[]) => {
      const warnings: string[] = [];
      parsed.forEach((g, i) => {
        if (!g.name) warnings.push(`Row ${i + 2}: missing name — will be skipped`);
      });
      if (parsed.length === 0) {
        warnings.push("No valid rows found. Check that your file has a header row and at least one data row.");
      }
      setCsvPreview(parsed);
      setCsvWarnings(warnings);
    };

    if (isXlsx) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const buffer = ev.target?.result as ArrayBuffer;
        const parsed = await parseXLSX(buffer);
        finish(parsed);
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        finish(parseCSV(text));
      };
      reader.readAsText(file);
    }
    e.target.value = "";
  }

  function confirmCsvImport() {
    if (!csvPreview) return;
    csvPreview.forEach((g, i) => {
      if (!g.name) return;
      // Re-import/update: match on email if both sides have one
      const existing = g.email
        ? guests.find((eg) => eg.email && eg.email.toLowerCase() === g.email!.toLowerCase())
        : undefined;
      if (existing) {
        updateGuest(existing.id, {
          name:          g.name,
          email:         g.email,
          address:       g.address       ?? existing.address,
          totalGuests:   g.totalGuests   ?? existing.totalGuests,
          dietary:       g.dietary       ?? existing.dietary,
          table:         g.table         ?? existing.table,
          relationship:  g.relationship  ?? existing.relationship,
          guestLocation: g.guestLocation ?? existing.guestLocation,
          side:          g.side          ?? existing.side,
        });
      } else {
        addGuest({
          id:            `guest-import-${Date.now()}-${i}`,
          name:          g.name,
          email:         g.email,
          address:       g.address,
          totalGuests:   g.totalGuests ?? 1,
          rsvp:          "pending",
          dietary:       g.dietary,
          table:         g.table,
          relationship:  g.relationship,
          guestLocation: g.guestLocation,
          side:          g.side,
        });
      }
    });
    setCsvPreview(null);
    setCsvWarnings([]);
  }

  function cancelCsvImport() {
    setCsvPreview(null);
    setCsvWarnings([]);
  }

  // ── vCard import ─────────────────────────────────────────────────────────

  function handleVcfFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const imported = parseVCard(text);
      imported.forEach((g, i) => {
        addGuest({
          id:      `guest-vcf-${Date.now()}-${i}`,
          name:    g.name ?? "Unknown",
          email:   g.email,
          address: g.address,
          totalGuests: 1,
          rsvp:        "pending",
        });
      });
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  // ── Derived counts ───────────────────────────────────────────────────────

  const filteredGuests = guests
    .filter((g) =>
      sideFilter === "all" ||
      g.side === sideFilter ||
      (sideFilter === "both" && g.side === "both")
    )
    .filter((g) => locationFilter === "all" || g.guestLocation === locationFilter);

  const byRsvp = (s: Guest["rsvp"]) => filteredGuests.filter((g) => g.rsvp === s);
  const counts = {
    yes:     byRsvp("yes").reduce((s, g) => s + g.totalGuests, 0),
    no:      byRsvp("no").reduce((s, g) => s + g.totalGuests, 0),
    maybe:   byRsvp("maybe").reduce((s, g) => s + g.totalGuests, 0),
    pending: byRsvp("pending").reduce((s, g) => s + g.totalGuests, 0),
  };
  const splits = {
    yes:       sideSplitCount(byRsvp("yes")),
    no:        sideSplitCount(byRsvp("no")),
    maybe:     sideSplitCount(byRsvp("maybe")),
    pending:   sideSplitCount(byRsvp("pending")),
    estimated: sideSplitEstimated(filteredGuests),
  };
  const estimated = estimatedAttendance(filteredGuests);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Guests</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {guests.reduce((s, g) => s + g.totalGuests, 0)} invited &middot; {counts.yes} confirmed &middot; {counts.pending} pending
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button onClick={() => downloadXLSXTemplate()}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:border-[#D4537E] hover:text-[#D4537E] transition-colors">
            Download template
          </button>
          <button onClick={() => csvInputRef.current?.click()}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors">
            Import CSV / XLSX
          </button>
          {guests.length > 0 && (
            <button onClick={() => exportGuestsXLSX(guests)}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:border-[#D4537E] hover:text-[#D4537E] transition-colors">
              Export
            </button>
          )}
          <button onClick={() => vcfInputRef.current?.click()}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors">
            Import vCard
          </button>
          <button onClick={() => setAdding(true)}
            className="px-4 py-2 bg-[var(--accent)] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-colors">
            Add guest
          </button>
        </div>
        <input ref={csvInputRef} type="file" accept=".csv,.tsv,.txt,.xlsx" className="hidden" onChange={handleImportFile} />
        <input ref={vcfInputRef} type="file" accept=".vcf,.vcard"   className="hidden" onChange={handleVcfFile} />
      </div>

      {/* Side of family filter */}
      {guests.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {(["all", ...SIDES] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSideFilter(s)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                sideFilter === s
                  ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                  : "border-gray-200 text-gray-500 hover:border-[var(--accent)] hover:text-[var(--accent)]"
              }`}
            >
              {s === "all" ? "All guests" : SIDE_LABELS[s]}
            </button>
          ))}
        </div>
      )}

      {/* Location filter */}
      {guests.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {(["all", ...LOCATIONS] as const).map((l) => {
            const count = l === "all"
              ? guests.reduce((s, g) => s + g.totalGuests, 0)
              : guests.filter((g) => g.guestLocation === l).reduce((s, g) => s + g.totalGuests, 0);
            const label = l === "all" ? "All locations" : LOCATION_LABELS[l];
            return (
              <button
                key={l}
                onClick={() => setLocationFilter(l)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                  locationFilter === l
                    ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                    : "border-gray-200 text-gray-500 hover:border-[var(--accent)] hover:text-[var(--accent)]"
                }`}
              >
                {label} <span className={locationFilter === l ? "text-white/70" : "text-gray-400"}>({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {(["yes","no","maybe","pending"] as Guest["rsvp"][]).map((status) => (
          <div key={status} className="relative group">
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center cursor-default select-none">
              <p className="text-2xl font-bold text-gray-900">{counts[status]}</p>
              <p className="text-xs text-gray-400 capitalize mt-0.5">{status}</p>
            </div>
            <div className="hidden group-hover:block">
              <SideTooltip split={splits[status]} />
            </div>
          </div>
        ))}
        {guests.length > 0 && (
          <div className="relative group">
            <div className="bg-[var(--accent)]/10 border border-[var(--accent)]/30 rounded-xl p-4 text-center cursor-default select-none">
              <p className="text-2xl font-bold text-[var(--accent)]">{estimated}</p>
              <p className="text-xs text-[var(--accent)]/70 mt-0.5">Est. attending</p>
            </div>
            <div className="hidden group-hover:block">
              <SideTooltip split={splits.estimated} />
            </div>
          </div>
        )}
      </div>

      {/* CSV import preview */}
      {csvPreview && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">
              {(() => {
                const valid = csvPreview.filter((g) => g.name);
                const updates = valid.filter((g) => g.email && guests.some((eg) => eg.email && eg.email.toLowerCase() === g.email!.toLowerCase())).length;
                const adds = valid.length - updates;
                return `Preview import — ${adds > 0 ? `${adds} new` : ""}${adds > 0 && updates > 0 ? ", " : ""}${updates > 0 ? `${updates} update` : ""}`;
              })()}
            </h3>
            <button onClick={cancelCsvImport} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
          </div>
          {csvWarnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 space-y-1">
              {csvWarnings.map((w, i) => (
                <p key={i} className="text-xs text-yellow-800">{w}</p>
              ))}
            </div>
          )}
          <div className="max-h-52 overflow-y-auto divide-y divide-gray-100 rounded-lg border border-gray-100">
            {csvPreview.filter((g) => g.name).map((g, i) => {
              const existingByEmail = g.email
                ? guests.find((eg) => eg.email && eg.email.toLowerCase() === g.email!.toLowerCase())
                : undefined;
              return (
                <div key={i} className="flex items-center gap-3 px-3 py-2">
                  <p className="text-sm font-medium text-gray-800 w-40 shrink-0">{g.name}</p>
                  {existingByEmail && (
                    <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">update</span>
                  )}
                  {g.email        && <p className="text-xs text-gray-400">{g.email}</p>}
                  {g.relationship && <span className="text-xs text-gray-400">{RELATIONSHIP_LABELS[g.relationship]}</span>}
                  {g.guestLocation && <span className="text-xs text-gray-400">{LOCATION_LABELS[g.guestLocation]}</span>}
                  {g.side         && <span className="text-xs text-gray-400">{SIDE_LABELS[g.side]}</span>}
                  {(g.totalGuests ?? 1) > 1 && <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">×{g.totalGuests}</span>}
                </div>
              );
            })}
          </div>
          <div className="flex gap-2">
            <button onClick={confirmCsvImport}
              className="px-4 py-2 bg-[#D4537E] text-white text-sm font-medium rounded-lg hover:bg-[#bf4a70] transition-colors">
              Confirm import
            </button>
            <button onClick={cancelCsvImport} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Attendance likelihood info icon */}
      {guests.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400">Attendance likelihood</span>
          <div className="relative group inline-flex">
            <button className="w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-[10px] font-bold flex items-center justify-center hover:bg-gray-300 transition-colors leading-none">
              i
            </button>
            <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 bg-gray-900 text-white text-xs rounded-lg px-3 py-2.5 shadow-xl whitespace-nowrap pointer-events-none">
              <p className="font-semibold text-gray-300 mb-2">Estimated attendance by relationship &amp; location</p>
              <table className="border-separate border-spacing-x-3 border-spacing-y-0.5">
                <thead>
                  <tr>
                    <th className="text-left text-gray-400 font-normal" />
                    {LOCATIONS.map((l) => (
                      <th key={l} className="text-center text-gray-400 font-normal">{LOCATION_LABELS[l]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {RELATIONSHIPS.map((r) => (
                    <tr key={r}>
                      <td className="text-gray-300">{RELATIONSHIP_LABELS[r]}</td>
                      {LOCATIONS.map((l) => (
                        <td key={l} className="text-center font-semibold">
                          {Math.round({ family: { local: 1.00, out_of_town: 0.85 }, close_friend: { local: 1.00, out_of_town: 0.75 }, friend: { local: 0.75, out_of_town: 0.45 }, acquaintance: { local: 0.50, out_of_town: 0.25 } }[r][l] * 100)}%
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
            </div>
          </div>
        </div>
      )}

      {/* Add form */}
      {adding && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">New guest</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Name *</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Full name"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="email@example.com"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Relationship</label>
              <select value={form.relationship} onChange={(e) => setForm((f) => ({ ...f, relationship: e.target.value as GuestRelationship }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]">
                <option value="">— unset —</option>
                {RELATIONSHIPS.map((r) => <option key={r} value={r}>{RELATIONSHIP_LABELS[r]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Location</label>
              <select value={form.guestLocation} onChange={(e) => setForm((f) => ({ ...f, guestLocation: e.target.value as GuestLocation }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]">
                <option value="">— unset —</option>
                {LOCATIONS.map((l) => <option key={l} value={l}>{LOCATION_LABELS[l]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Table</label>
              <input value={form.table} onChange={(e) => setForm((f) => ({ ...f, table: e.target.value }))}
                placeholder="Table name/number"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Side of family</label>
              <select value={form.side} onChange={(e) => setForm((f) => ({ ...f, side: e.target.value as GuestSide }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]">
                <option value="">— unset —</option>
                {SIDES.map((s) => <option key={s} value={s}>{SIDE_LABELS[s]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Dietary needs</label>
              <input value={form.dietary} onChange={(e) => setForm((f) => ({ ...f, dietary: e.target.value }))}
                placeholder="e.g. vegetarian"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Address</label>
            <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="123 Main St, Denver CO 80202"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Total guests</label>
            <input type="number" min={1} max={20} inputMode="numeric" value={form.totalGuests}
              onChange={(e) => setForm((f) => ({ ...f, totalGuests: e.target.value }))}
              className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd}
              className="px-4 py-2 bg-[var(--accent)] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-colors">
              Add
            </button>
            <button onClick={() => setAdding(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
              Cancel
            </button>
          </div>
        </div>
      )}

      {guests.length === 0 && !adding && (
        <div className="border-2 border-dashed border-gray-200 rounded-2xl py-16 flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">No guests yet</p>
            <p className="text-xs text-gray-400 mt-0.5">Add guests manually or import a CSV / vCard file</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <button
              onClick={() => csvInputRef.current?.click()}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
            >
              Import CSV / XLSX
            </button>
            <button
              onClick={() => vcfInputRef.current?.click()}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
            >
              Import vCard
            </button>
            <button
              onClick={() => setAdding(true)}
              className="px-4 py-2 bg-[var(--accent)] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-colors"
            >
              Add your first guest
            </button>
          </div>
          <p className="text-xs text-gray-300 mt-1">Accepts CSV or XLSX — columns: name, email, address, relationship, location, totalguests, dietary, table</p>
        </div>
      )}

      {/* Guest table */}
      {filteredGuests.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left text-xs font-medium text-gray-400 px-4 py-2.5">Name</th>
                <th className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">RSVP</th>
                <th className="text-left text-xs font-medium text-gray-400 px-3 py-2.5 hidden sm:table-cell">Relationship</th>
                <th className="text-left text-xs font-medium text-gray-400 px-3 py-2.5 hidden md:table-cell">Location</th>
                <th className="text-left text-xs font-medium text-gray-400 px-3 py-2.5 hidden md:table-cell">Side</th>
                <th className="text-left text-xs font-medium text-gray-400 px-3 py-2.5 hidden lg:table-cell">Likelihood</th>
                <th className="text-left text-xs font-medium text-gray-400 px-3 py-2.5 hidden lg:table-cell">Table</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredGuests.map((guest) => {
                const prob = getBaseProbability(guest);
                const showProb = guest.rsvp === "pending" || guest.rsvp === "maybe";

                if (editingId === guest.id) {
                  return (
                    <tr key={guest.id}>
                      <td colSpan={8} className="p-3">
                        <EditGuestForm
                          guest={guest}
                          onSave={(u) => { updateGuest(guest.id, u); setEditingId(null); }}
                          onCancel={() => setEditingId(null)}
                        />
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={guest.id}
                    onClick={() => setEditingId(guest.id)}
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{guest.name}</span>
                        {guest.totalGuests > 1 && <Badge variant="blue">×{guest.totalGuests}</Badge>}
                      </div>
                      {(guest.email || guest.dietary) && (
                        <div className="flex gap-2 mt-0.5">
                          {guest.email   && <span className="text-xs text-gray-400">{guest.email}</span>}
                          {guest.dietary && <span className="text-xs text-gray-400">{guest.dietary}</span>}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={guest.rsvp}
                        onChange={(e) => updateGuest(guest.id, { rsvp: e.target.value as Guest["rsvp"] })}
                        className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-[var(--accent)]"
                      >
                        <option value="pending">Pending</option>
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                        <option value="maybe">Maybe</option>
                      </select>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500 hidden sm:table-cell">
                      {guest.relationship ? RELATIONSHIP_LABELS[guest.relationship] : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500 hidden md:table-cell">
                      {guest.guestLocation ? LOCATION_LABELS[guest.guestLocation] : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500 hidden md:table-cell">
                      {guest.side ? SIDE_LABELS[guest.side] : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-3 text-xs hidden lg:table-cell">
                      {showProb
                        ? <span className="font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">{Math.round(prob * 100)}%</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500 hidden lg:table-cell">
                      {guest.table || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="pr-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => removeGuest(guest.id)}
                        className="text-gray-300 hover:text-red-400 transition-colors p-1"
                        title="Remove guest"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
