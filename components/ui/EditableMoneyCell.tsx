"use client";

import { useState, useEffect, useRef } from "react";

// Format a number as "$X,XXX". Falls back to em-dash for empty/zero/NaN.
export function fmtMoney(n: number | undefined | null): string {
  if (n === undefined || n === null) return "—";
  if (!Number.isFinite(n) || n === 0) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

// Format a plain number with thousand separators (no currency prefix) — used
// inside text inputs while editing so the user sees grouping but no $.
function fmtPlain(n: number | undefined | null): string {
  if (n === undefined || n === null) return "";
  if (!Number.isFinite(n)) return "";
  return Math.round(n).toLocaleString();
}

// Parse user input — strips $, commas, spaces. Returns undefined if blank,
// NaN if unparseable.
function parseMoney(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return undefined;
  const cleaned = trimmed.replace(/[$,\s]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

interface Props {
  value: number | undefined;
  onCommit: (next: number | undefined) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  // When true, the cell shows a faded em-dash for zero/empty (but is still
  // editable on click).
  fadeEmpty?: boolean;
  // Forces the input to be permanently shown (no click-to-edit dance) — used
  // by the assumptions row where a single click should land in the field.
  alwaysEditing?: boolean;
}

// Click-to-edit money cell:
// - Displays "$X,XXX" when not focused.
// - On click, becomes a text input (no native number spinners, no scroll-wheel
//   jitter) seeded with the unformatted value.
// - Commits on blur or Enter. Empty / NaN clears the underlying value.
export function EditableMoneyCell({
  value,
  onCommit,
  placeholder = "—",
  className = "",
  ariaLabel,
  fadeEmpty = false,
  alwaysEditing = false,
}: Props) {
  const [editing, setEditing] = useState(alwaysEditing);
  const [raw, setRaw] = useState(fmtPlain(value));
  const inputRef = useRef<HTMLInputElement>(null);

  // Re-sync the local string whenever the external value changes (and we're
  // not in the middle of editing).
  useEffect(() => {
    if (!editing) setRaw(fmtPlain(value)); // eslint-disable-line react-hooks/set-state-in-effect
  }, [value, editing]);

  useEffect(() => {
    if (editing && !alwaysEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing, alwaysEditing]);

  function commit() {
    const parsed = parseMoney(raw);
    if (parsed === undefined) {
      // empty → clear
      if (value !== undefined) onCommit(undefined);
    } else if (Number.isFinite(parsed)) {
      if (parsed !== value) onCommit(parsed);
    } else {
      // unparseable → revert
      setRaw(fmtPlain(value));
    }
    if (!alwaysEditing) setEditing(false);
  }

  const empty = value === undefined || !Number.isFinite(value) || value === 0;
  const baseInputCls =
    "w-full text-right tabular-nums rounded px-2 py-1 text-xs border focus:outline-none";

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={raw}
        aria-label={ariaLabel}
        onChange={(e) => {
          // Allow digits, commas, dots, leading -. Block letters/other.
          const v = e.target.value.replace(/[^\d.,\-]/g, "");
          setRaw(v);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            (e.target as HTMLInputElement).blur();
          } else if (e.key === "Escape") {
            setRaw(fmtPlain(value));
            if (!alwaysEditing) setEditing(false);
          }
        }}
        placeholder={placeholder}
        className={`${baseInputCls} border-[var(--accent)] bg-white ${className}`}
      />
    );
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={() => setEditing(true)}
      className={`w-full text-right tabular-nums rounded px-2 py-1 text-xs border border-transparent hover:border-gray-200 focus:outline-none focus:border-[var(--accent)] cursor-text ${
        empty && fadeEmpty ? "text-gray-300" : "text-gray-700"
      } ${className}`}
      title="Click to edit"
    >
      {empty ? placeholder : fmtMoney(value)}
    </button>
  );
}

// Plain-number variant (no $ prefix) for non-currency numerics like "Hours
// included" or "Event hours". Shares the spinner-free input plumbing.
interface NumberProps {
  value: number | undefined;
  onCommit: (next: number | undefined) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  suffix?: string; // e.g. "h" for hours
  fadeEmpty?: boolean;
}

export function EditableNumberCell({
  value,
  onCommit,
  placeholder = "—",
  className = "",
  ariaLabel,
  suffix,
  fadeEmpty = false,
}: NumberProps) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(value !== undefined && Number.isFinite(value) ? String(value) : "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRaw(value !== undefined && Number.isFinite(value) ? String(value) : "");
    }
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function commit() {
    const trimmed = raw.trim();
    if (trimmed === "") {
      if (value !== undefined) onCommit(undefined);
    } else {
      const n = parseFloat(trimmed.replace(/[,\s]/g, ""));
      if (Number.isFinite(n)) {
        if (n !== value) onCommit(n);
      } else {
        setRaw(value !== undefined ? String(value) : "");
      }
    }
    setEditing(false);
  }

  const empty = value === undefined || !Number.isFinite(value);

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={raw}
        aria-label={ariaLabel}
        onChange={(e) => setRaw(e.target.value.replace(/[^\d.,\-]/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          else if (e.key === "Escape") { setRaw(value !== undefined ? String(value) : ""); setEditing(false); }
        }}
        placeholder={placeholder}
        className={`w-full text-right tabular-nums rounded px-2 py-1 text-xs border border-[var(--accent)] bg-white focus:outline-none ${className}`}
      />
    );
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={() => setEditing(true)}
      className={`w-full text-right tabular-nums rounded px-2 py-1 text-xs border border-transparent hover:border-gray-200 focus:outline-none focus:border-[var(--accent)] cursor-text ${
        empty && fadeEmpty ? "text-gray-300" : "text-gray-700"
      } ${className}`}
      title="Click to edit"
    >
      {empty ? placeholder : (suffix ? `${value}${suffix}` : String(value))}
    </button>
  );
}
