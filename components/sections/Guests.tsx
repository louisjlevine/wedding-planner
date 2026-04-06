"use client";

import { useState, useRef } from "react";
import { usePlanStore } from "@/lib/plan-store";
import { Badge } from "@/components/ui/Badge";
import {
  getBaseProbability,
  estimatedAttendance,
  RELATIONSHIP_LABELS,
  LOCATION_LABELS,
} from "@/lib/guest-probability";
import type { Guest, GuestRelationship, GuestLocation } from "@/lib/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const RSVP_VARIANTS: Record<Guest["rsvp"], "green" | "red" | "yellow" | "gray"> = {
  yes: "green", no: "red", maybe: "yellow", pending: "gray",
};

const RELATIONSHIPS: GuestRelationship[] = ["family", "close_friend", "friend", "acquaintance"];
const LOCATIONS: GuestLocation[] = ["local", "out_of_town"];

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
      plusone:      ["plusone", "plus_one", "guest"],
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
    return {
      name,
      email:        col(row, "email")   || undefined,
      address:      col(row, "address") || undefined,
      dietary:      col(row, "dietary") || undefined,
      table:        col(row, "table")   || undefined,
      plusOne:      ["yes","true","1","x"].includes(col(row, "plusone").toLowerCase()),
      relationship: rel,
      guestLocation: loc,
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
      plusOne: false,
      rsvp: "pending" as const,
    };
  }).filter(Boolean) as Partial<Guest>[];
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
    plusOne:       guest.plusOne,
    dietary:       guest.dietary ?? "",
    table:         guest.table   ?? "",
    rsvp:          guest.rsvp,
  });

  return (
    <div className="bg-pink-50/30 border border-[#D4537E] rounded-xl px-5 py-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Name</label>
          <input value={d.name} onChange={(e) => setD((x) => ({ ...x, name: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#D4537E]" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Email</label>
          <input type="email" value={d.email} onChange={(e) => setD((x) => ({ ...x, email: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#D4537E]" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Relationship</label>
          <select value={d.relationship} onChange={(e) => setD((x) => ({ ...x, relationship: e.target.value as GuestRelationship }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#D4537E]">
            <option value="">— unset —</option>
            {RELATIONSHIPS.map((r) => <option key={r} value={r}>{RELATIONSHIP_LABELS[r]}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Location</label>
          <select value={d.guestLocation} onChange={(e) => setD((x) => ({ ...x, guestLocation: e.target.value as GuestLocation }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#D4537E]">
            <option value="">— unset —</option>
            {LOCATIONS.map((l) => <option key={l} value={l}>{LOCATION_LABELS[l]}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">RSVP</label>
          <select value={d.rsvp} onChange={(e) => setD((x) => ({ ...x, rsvp: e.target.value as Guest["rsvp"] }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#D4537E]">
            <option value="pending">Pending</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
            <option value="maybe">Maybe</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Table</label>
          <input value={d.table} onChange={(e) => setD((x) => ({ ...x, table: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#D4537E]" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Dietary</label>
          <input value={d.dietary} onChange={(e) => setD((x) => ({ ...x, dietary: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#D4537E]" />
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Address</label>
        <input value={d.address} onChange={(e) => setD((x) => ({ ...x, address: e.target.value }))}
          placeholder="123 Main St, Denver CO 80202"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#D4537E]" />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={d.plusOne} onChange={(e) => setD((x) => ({ ...x, plusOne: e.target.checked }))}
          className="rounded border-gray-300" />
        Plus one
      </label>
      <div className="flex gap-2">
        <button onClick={() => onSave({
          name:          d.name.trim() || guest.name,
          email:         d.email    || undefined,
          address:       d.address  || undefined,
          relationship:  d.relationship  || undefined,
          guestLocation: d.guestLocation || undefined,
          plusOne:       d.plusOne,
          dietary:       d.dietary  || undefined,
          table:         d.table    || undefined,
          rsvp:          d.rsvp,
        })}
          className="px-4 py-2 bg-[#D4537E] text-white text-sm font-medium rounded-lg hover:bg-[#bf4a70] transition-colors">
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
  const [form, setForm] = useState({
    name: "", email: "", address: "", plusOne: false, dietary: "", table: "",
    relationship: "" as GuestRelationship | "",
    guestLocation: "" as GuestLocation | "",
  });

  const csvInputRef  = useRef<HTMLInputElement>(null);
  const vcfInputRef  = useRef<HTMLInputElement>(null);

  // ── Add single guest ─────────────────────────────────────────────────────

  function handleAdd() {
    if (!form.name.trim()) return;
    addGuest({
      id:            `guest-${Date.now()}`,
      name:          form.name,
      email:         form.email         || undefined,
      address:       form.address       || undefined,
      plusOne:       form.plusOne,
      rsvp:          "pending",
      dietary:       form.dietary       || undefined,
      table:         form.table         || undefined,
      relationship:  form.relationship  || undefined,
      guestLocation: form.guestLocation || undefined,
    });
    setForm({ name: "", email: "", address: "", plusOne: false, dietary: "", table: "", relationship: "", guestLocation: "" });
    setAdding(false);
  }

  // ── CSV import ───────────────────────────────────────────────────────────

  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const imported = parseCSV(text);
      imported.forEach((g, i) => {
        addGuest({
          id:            `guest-import-${Date.now()}-${i}`,
          name:          g.name ?? "Unknown",
          email:         g.email,
          address:       g.address,
          plusOne:       g.plusOne ?? false,
          rsvp:          "pending",
          dietary:       g.dietary,
          table:         g.table,
          relationship:  g.relationship,
          guestLocation: g.guestLocation,
        });
      });
    };
    reader.readAsText(file);
    e.target.value = "";
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
          plusOne: false,
          rsvp:    "pending",
        });
      });
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  // ── Derived counts ───────────────────────────────────────────────────────

  const counts = {
    yes:     guests.filter((g) => g.rsvp === "yes").length,
    no:      guests.filter((g) => g.rsvp === "no").length,
    maybe:   guests.filter((g) => g.rsvp === "maybe").length,
    pending: guests.filter((g) => g.rsvp === "pending").length,
  };
  const estimated = estimatedAttendance(guests);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Guests</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {guests.length} invited &middot; {counts.yes} confirmed &middot; {counts.pending} pending
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button onClick={() => csvInputRef.current?.click()}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:border-[#D4537E] hover:text-[#D4537E] transition-colors">
            Import CSV
          </button>
          <button onClick={() => vcfInputRef.current?.click()}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:border-[#D4537E] hover:text-[#D4537E] transition-colors">
            Import vCard
          </button>
          <button onClick={() => setAdding(true)}
            className="px-4 py-2 bg-[#D4537E] text-white text-sm font-medium rounded-lg hover:bg-[#bf4a70] transition-colors">
            Add guest
          </button>
        </div>
        <input ref={csvInputRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={handleCsvFile} />
        <input ref={vcfInputRef} type="file" accept=".vcf,.vcard"   className="hidden" onChange={handleVcfFile} />
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-5 gap-3">
        {(["yes","no","maybe","pending"] as Guest["rsvp"][]).map((status) => (
          <div key={status} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{counts[status]}</p>
            <p className="text-xs text-gray-400 capitalize mt-0.5">{status}</p>
          </div>
        ))}
        {guests.length > 0 && (
          <div className="bg-pink-50 border border-pink-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-[#D4537E]">{estimated}</p>
            <p className="text-xs text-[#D4537E]/70 mt-0.5">Est. attending</p>
          </div>
        )}
      </div>

      {/* Probability legend */}
      {guests.length > 0 && (
        <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
          <p className="text-xs font-medium text-gray-500 mb-2">Attendance likelihood by relationship &amp; location</p>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {RELATIONSHIPS.map((r) =>
              LOCATIONS.map((l) => (
                <span key={`${r}-${l}`} className="text-xs text-gray-400">
                  <span className="font-medium text-gray-600">{RELATIONSHIP_LABELS[r]}</span>
                  {" + "}{LOCATION_LABELS[l]}: {Math.round(
                    { family: { local: 0.95, out_of_town: 0.75 }, close_friend: { local: 0.90, out_of_town: 0.65 }, friend: { local: 0.75, out_of_town: 0.45 }, acquaintance: { local: 0.50, out_of_town: 0.25 } }[r][l] * 100
                  )}%
                </span>
              ))
            )}
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
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#D4537E]" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="email@example.com"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#D4537E]" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Relationship</label>
              <select value={form.relationship} onChange={(e) => setForm((f) => ({ ...f, relationship: e.target.value as GuestRelationship }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#D4537E]">
                <option value="">— unset —</option>
                {RELATIONSHIPS.map((r) => <option key={r} value={r}>{RELATIONSHIP_LABELS[r]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Location</label>
              <select value={form.guestLocation} onChange={(e) => setForm((f) => ({ ...f, guestLocation: e.target.value as GuestLocation }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#D4537E]">
                <option value="">— unset —</option>
                {LOCATIONS.map((l) => <option key={l} value={l}>{LOCATION_LABELS[l]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Table</label>
              <input value={form.table} onChange={(e) => setForm((f) => ({ ...f, table: e.target.value }))}
                placeholder="Table name/number"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#D4537E]" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Dietary needs</label>
              <input value={form.dietary} onChange={(e) => setForm((f) => ({ ...f, dietary: e.target.value }))}
                placeholder="e.g. vegetarian"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#D4537E]" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Address</label>
            <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="123 Main St, Denver CO 80202"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#D4537E]" />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.plusOne} onChange={(e) => setForm((f) => ({ ...f, plusOne: e.target.checked }))}
              className="rounded border-gray-300" />
            Plus one
          </label>
          <div className="flex gap-2">
            <button onClick={handleAdd}
              className="px-4 py-2 bg-[#D4537E] text-white text-sm font-medium rounded-lg hover:bg-[#bf4a70] transition-colors">
              Add
            </button>
            <button onClick={() => setAdding(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
              Cancel
            </button>
          </div>
        </div>
      )}

      {guests.length === 0 && !adding && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-sm">No guests yet. Add manually or import a CSV / vCard file.</p>
          <p className="text-xs mt-1 text-gray-300">CSV columns: name, email, address, relationship, location, plusone, dietary, table</p>
        </div>
      )}

      {/* Guest rows */}
      <div className="space-y-2">
        {guests.map((guest) => {
          if (editingId === guest.id) {
            return (
              <EditGuestForm
                key={guest.id}
                guest={guest}
                onSave={(u) => { updateGuest(guest.id, u); setEditingId(null); }}
                onCancel={() => setEditingId(null)}
              />
            );
          }

          const prob = getBaseProbability(guest);
          const showProb = guest.rsvp === "pending" || guest.rsvp === "maybe";

          return (
            <div key={guest.id}
              className="bg-white border border-gray-200 rounded-xl px-5 py-3 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900">{guest.name}</p>
                  {guest.plusOne && <Badge variant="blue">+1</Badge>}
                  <Badge variant={RSVP_VARIANTS[guest.rsvp]}>{guest.rsvp}</Badge>
                  {guest.relationship && (
                    <span className="text-xs text-gray-400">{RELATIONSHIP_LABELS[guest.relationship]}</span>
                  )}
                  {guest.guestLocation && (
                    <span className="text-xs text-gray-400">{LOCATION_LABELS[guest.guestLocation]}</span>
                  )}
                  {showProb && (
                    <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                      {Math.round(prob * 100)}% likely
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  {guest.email   && <p className="text-xs text-gray-400">{guest.email}</p>}
                  {guest.address && <p className="text-xs text-gray-400 truncate max-w-xs">{guest.address}</p>}
                  {guest.table   && <p className="text-xs text-gray-400">Table: {guest.table}</p>}
                  {guest.dietary && <p className="text-xs text-gray-400">{guest.dietary}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => setEditingId(guest.id)}
                  className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
                  edit
                </button>
                <select value={guest.rsvp} onChange={(e) => updateGuest(guest.id, { rsvp: e.target.value as Guest["rsvp"] })}
                  className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-[#D4537E]">
                  <option value="pending">Pending</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                  <option value="maybe">Maybe</option>
                </select>
                <button onClick={() => removeGuest(guest.id)}
                  className="text-xs text-gray-300 hover:text-red-400 transition-colors">
                  remove
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
