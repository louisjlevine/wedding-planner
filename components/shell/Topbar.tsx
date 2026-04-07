"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { usePlanStore } from "@/lib/plan-store";

export function Topbar() {
  const { answers, resetIntake, setActiveTab, importStore } = usePlanStore();
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

  const daysUntil = answers?.date
    ? Math.ceil(
        (new Date(answers.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
    : null;

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-3">
        {answers && (
          <>
            <span className="text-sm font-medium text-gray-900">
              Louis & {answers.partnerName}
            </span>
            {daysUntil !== null && daysUntil > 0 && (
              <span className="text-xs bg-pink-50 text-[#D4537E] border border-pink-200 px-2 py-0.5 rounded-full font-medium">
                {daysUntil} days to go
              </span>
            )}
          </>
        )}
      </div>
      <div className="flex items-center gap-3">
        {answers && (
          <button
            onClick={() => setActiveTab("advisor")}
            className="px-3 py-1.5 text-xs font-medium text-[#D4537E] border border-pink-200 rounded-lg hover:bg-pink-50 transition-colors"
          >
            Ask advisor
          </button>
        )}
        <button
          onClick={handleExport}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Export
        </button>
        <button
          onClick={() => importRef.current?.click()}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Import
        </button>
        <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
        <button
          onClick={resetIntake}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Reset
        </button>
        <button
          onClick={handleLogout}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
