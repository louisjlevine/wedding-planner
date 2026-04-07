"use client";

import { usePlan } from "@/hooks/usePlan";
import { usePlanStore } from "@/lib/plan-store";
import { Badge } from "@/components/ui/Badge";

export function Timeline() {
  const { timeline, answers } = usePlan();
  const { toggleTimelineItem } = usePlanStore();

  if (!answers) return null;

  const today = new Date().toISOString().split("T")[0];

  const grouped = timeline.reduce<Record<string, typeof timeline>>((acc, item) => {
    const key = item.category;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Timeline</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Your wedding planning roadmap, personalised to {answers.date} &middot;{" "}
          {timeline.filter((t) => t.done).length} of {timeline.length} done
        </p>
      </div>

      <div className="space-y-2">
        {timeline.map((item) => {
          const isPast = item.targetDate < today;
          const isToday = item.targetDate === today;

          return (
            <div
              key={item.id}
              className={`bg-white border rounded-xl px-5 py-4 flex items-start gap-4 ${
                isToday
                  ? "border-[#D4537E] ring-1 ring-[#D4537E]/20"
                  : "border-gray-200"
              } ${isPast && !item.done ? "opacity-60" : ""}`}
            >
              <div className="shrink-0 mt-0.5">
                <button
                  onClick={() => toggleTimelineItem(item.id)}
                  title={item.done ? "Mark incomplete" : "Mark complete"}
                  className={`w-4 h-4 rounded-full border-2 transition-colors hover:opacity-70 ${
                    item.done
                      ? "bg-[#D4537E] border-[#D4537E]"
                      : isToday
                      ? "border-[#D4537E]"
                      : "border-gray-300 hover:border-[#D4537E]"
                  }`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p
                    className={`text-sm font-medium ${
                      item.done ? "line-through text-gray-400" : "text-gray-900"
                    }`}
                  >
                    {item.title}
                  </p>
                  <Badge variant="gray">{item.category}</Badge>
                  {item.flag && <Badge variant="pink">Note</Badge>}
                </div>
                {item.flag && (
                  <p className="text-xs text-[#D4537E] mt-1">{item.flag}</p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-medium text-gray-500">
                  {item.targetDate
                    ? new Date(item.targetDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : ""}
                </p>
                {item.monthsBefore > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {item.monthsBefore}mo before
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
