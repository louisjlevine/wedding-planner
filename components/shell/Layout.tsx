"use client";

import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { usePlanStore } from "@/lib/plan-store";
import { Intake } from "@/components/sections/Intake";
import { Overview } from "@/components/sections/Overview";
import { Timeline } from "@/components/sections/Timeline";
import { Budget } from "@/components/sections/Budget";
import { Tasks } from "@/components/sections/Tasks";
import { Vendors } from "@/components/sections/Vendors";
import { Guests } from "@/components/sections/Guests";
import { Research } from "@/components/sections/Research";
import { Advisor } from "@/components/sections/Advisor";

export function Layout() {
  const { intakeComplete, activeTab } = usePlanStore();

  if (!intakeComplete) {
    return <Intake />;
  }

  const sections: Record<string, React.ReactNode> = {
    overview: <Overview />,
    timeline: <Timeline />,
    budget: <Budget />,
    tasks: <Tasks />,
    vendors: <Vendors />,
    guests: <Guests />,
    research: <Research />,
    advisor: <Advisor />,
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          {sections[activeTab]}
        </main>
      </div>
    </div>
  );
}
