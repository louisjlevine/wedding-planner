"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { usePlanStore } from "@/lib/plan-store";
import { useServerSync } from "@/hooks/useServerSync";
import { Intake } from "@/components/sections/Intake";
import { Overview } from "@/components/sections/Overview";
import { Timeline } from "@/components/sections/Timeline";
import { Budget } from "@/components/sections/Budget";
import { Vendors } from "@/components/sections/Vendors";
import { Compare } from "@/components/sections/Compare";
import { Guests } from "@/components/sections/Guests";
import { Advisor } from "@/components/sections/Advisor";
import { DigestSettings } from "@/components/sections/DigestSettings";
import { Research } from "@/components/sections/Research";

export function Layout() {
  const { intakeComplete, activeTab } = usePlanStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useServerSync();

  const sections: Record<string, React.ReactNode> = {
    overview: <Overview />,
    advisor: <Advisor />,
    research: <Research />,
    budget: <Budget />,
    timeline: <Timeline />,
    vendors: <Vendors />,
    compare: <Compare />,
    guests: <Guests />,
    digest: <DigestSettings />,
  };

  if (!intakeComplete) {
    return <Intake />;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar — always visible on md+, slide-in overlay on mobile */}
        <div
          className={`fixed md:relative inset-y-0 left-0 z-50 md:z-auto transition-transform duration-200 md:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}
        >
          <Sidebar onClose={() => setSidebarOpen(false)} />
        </div>

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Topbar onMenuClick={() => setSidebarOpen((v) => !v)} />
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 pb-24 md:p-6 md:pb-28">
            {sections[activeTab]}
          </main>
        </div>
      </div>
    </div>
  );
}
