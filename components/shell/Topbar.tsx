"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { usePlanStore } from "@/lib/plan-store";
import { daysUntil as daysUntilDate, describeWeddingDate } from "@/lib/date-utils";
import { IconButton } from "@/components/ui/Button";

interface TopbarProps {
  onMenuClick: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { answers, setActiveTab, importStore } = usePlanStore();
  const router = useRouter();
  const importRef = useRef<HTMLInputElement>(null);

  function handleExport() {
    const raw = localStorage.getItem("wedding-planner-store");
    if (!raw) return;
    const blob = new Blob([raw], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "wedding-planner-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        const state = parsed?.state ?? parsed;
        importStore(state);
      } catch {
        alert("Invalid backup file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const daysUntil = daysUntilDate(
    answers?.date,
    Date.now() // eslint-disable-line react-hooks/purity
  );
  // Approximate dates come from a season + year, so the countdown is an estimate.
  const dateIsApproximate = !!answers && !answers.dateIsExact;

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-4 md:px-6 shrink-0">
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMenuClick}
          className="md:hidden p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
          aria-label="Open menu"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {answers && (
          <>
            <span className="text-sm font-semibold text-gray-900">
              Louis & {answers.partnerName}
            </span>
            {daysUntil !== null && daysUntil > 0 && (
              <span
                title={describeWeddingDate(answers)}
                className="hidden sm:inline text-xs bg-[var(--accent)]/10 text-[var(--accent)] px-2.5 py-0.5 rounded-full font-semibold"
              >
                {dateIsApproximate ? "~" : ""}{daysUntil} days to go
              </span>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        {answers && (
          <button
            onClick={() => setActiveTab("advisor")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <span className="hidden sm:inline">Ask advisor</span>
            <span className="sm:hidden">AI</span>
          </button>
        )}
        <div className="hidden md:flex items-center gap-0.5">
          <div className="w-px h-4 bg-gray-200 mx-1" />
          <IconButton onClick={handleExport} label="Export backup">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </IconButton>
          <IconButton onClick={() => importRef.current?.click()} label="Import backup">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12" />
            </svg>
          </IconButton>
          <IconButton onClick={handleLogout} label="Sign out">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </IconButton>
        </div>
        <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
      </div>
    </header>
  );
}
