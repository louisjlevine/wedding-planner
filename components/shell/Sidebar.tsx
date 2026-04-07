"use client";

import { usePlanStore } from "@/lib/plan-store";
import type { Tab } from "@/lib/types";

const NAV: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "advisor", label: "Advisor" },
  { id: "research", label: "Research" },
  { id: "timeline", label: "Timeline" },
  { id: "budget", label: "Budget" },
  { id: "tasks", label: "Tasks" },
  { id: "vendors", label: "Vendors" },
  { id: "guests", label: "Guests" },
];

export function Sidebar() {
  const { activeTab, setActiveTab } = usePlanStore();

  return (
    <aside className="w-52 shrink-0 bg-white border-r border-gray-200 flex flex-col">
      <div className="px-5 py-5 border-b border-gray-100">
        <p className="text-xs font-semibold text-[#D4537E] uppercase tracking-widest">
          Wedding Planner
        </p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === id
                ? "bg-pink-50 text-[#D4537E]"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
