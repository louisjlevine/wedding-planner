"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { usePlanStore } from "@/lib/plan-store";
import { Intake } from "@/components/sections/Intake";
import { Overview } from "@/components/sections/Overview";
import { Timeline } from "@/components/sections/Timeline";
import { Budget } from "@/components/sections/Budget";
import { Vendors } from "@/components/sections/Vendors";
import { Guests } from "@/components/sections/Guests";
import { Advisor } from "@/components/sections/Advisor";

export function Layout() {
  const { intakeComplete, activeTab } = usePlanStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!intakeComplete) {
    return <Intake />;
  }

  const sections: Record<string, React.ReactNode> = {
    overview: <Overview />,
    advisor: <Advisor />,
    budget: <Budget />,
    timeline: <Timeline />,
    vendors: <Vendors />,
    guests: <Guests />,
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
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
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {sections[activeTab]}
        </main>
      </div>
    </div>
  );
}
