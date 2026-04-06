"use client";

import { usePlanStore } from "@/lib/plan-store";

export function Topbar() {
  const { answers, resetIntake, setActiveTab } = usePlanStore();

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
          onClick={resetIntake}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Reset
        </button>
      </div>
    </header>
  );
}
