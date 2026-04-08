"use client";

import { useState } from "react";
import { usePlan } from "@/hooks/usePlan";
import { usePlanStore } from "@/lib/plan-store";
import { Badge } from "@/components/ui/Badge";
import type { Task } from "@/lib/types";

function priorityVariant(p: Task["priority"]) {
  return p === "high" ? "pink" : p === "medium" ? "yellow" : "gray";
}

function MilestoneRow({
  item,
  today,
  onToggle,
}: {
  item: ReturnType<typeof usePlan>["timeline"][number];
  today: string;
  onToggle: (id: string) => void;
}) {
  const isToday = item.targetDate === today;
  const isOverdue = !item.done && item.targetDate < today;

  return (
    <div
      className={`bg-white border rounded-xl px-5 py-4 flex items-start gap-4 ${
        isToday
          ? "border-[var(--accent)] ring-1 ring-[var(--accent)]/20"
          : isOverdue
          ? "border-red-200 bg-red-50/30"
          : "border-gray-200"
      }`}
    >
      <div className="shrink-0 mt-0.5">
        <button
          onClick={() => onToggle(item.id)}
          title={item.done ? "Mark incomplete" : "Mark complete"}
          className={`w-4 h-4 rounded-full border-2 transition-colors hover:opacity-70 ${
            item.done
              ? "bg-[var(--accent)] border-[var(--accent)]"
              : isToday
              ? "border-[var(--accent)]"
              : isOverdue
              ? "border-red-400 hover:border-red-500"
              : "border-gray-300 hover:border-[var(--accent)]"
          }`}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-sm font-medium ${item.done ? "line-through text-gray-400" : "text-gray-900"}`}>
            {item.title}
          </p>
          <Badge variant="gray">{item.category}</Badge>
          {item.flag && <Badge variant="pink">Note</Badge>}
        </div>
        {item.flag && (
          <p className="text-xs text-[var(--accent)] mt-1">{item.flag}</p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <p className={`text-xs font-medium ${isOverdue ? "text-red-500" : "text-gray-500"}`}>
          {item.targetDate
            ? new Date(item.targetDate).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : ""}
        </p>
        {item.monthsBefore > 0 && (
          <p className="text-xs text-gray-400 mt-0.5">{item.monthsBefore}mo before</p>
        )}
      </div>
    </div>
  );
}

type SubTab = "milestones" | "tasks";

export function Timeline() {
  const { timeline, tasks, answers, defaultTasks } = usePlan();
  const { toggleTimelineItem, toggleTask, addTask, removeTask } = usePlanStore();
  const [subTab, setSubTab] = useState<SubTab>("milestones");
  const [newTitle, setNewTitle] = useState("");

  if (!answers) return null;

  const today = new Date().toISOString().split("T")[0];

  // Merge default tasks with store tasks
  const storeTasks = tasks;
  const defaultIds = new Set(storeTasks.map((t) => t.id));
  const merged = [
    ...storeTasks,
    ...defaultTasks.filter((t) => !defaultIds.has(t.id)),
  ].sort((a, b) => {
    const pri = { high: 0, medium: 1, low: 2 };
    return pri[a.priority] - pri[b.priority];
  });

  const doneTasks = merged.filter((t) => t.done);
  const pendingTasks = merged.filter((t) => !t.done);
  const doneTimeline = timeline.filter((t) => t.done).length;

  // Group timeline into overdue / upcoming
  const overdueItems = timeline.filter((t) => !t.done && t.targetDate < today);
  const upcomingItems = timeline.filter((t) => !t.done && t.targetDate >= today);
  const doneItems = timeline.filter((t) => t.done);

  function handleAdd() {
    if (!newTitle.trim()) return;
    addTask({
      id: `custom-${Date.now()}`,
      title: newTitle.trim(),
      category: "Custom",
      priority: "medium",
      done: false,
    });
    setNewTitle("");
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Timeline & Tasks</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {doneTimeline} of {timeline.length} milestones done &middot;{" "}
          {doneTasks.length} of {merged.length} tasks done
        </p>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(["milestones", "tasks"] as SubTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
              subTab === tab
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Milestones tab */}
      {subTab === "milestones" && (
        <div className="space-y-6">
          {overdueItems.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-red-500 mb-2">
                Overdue — {overdueItems.length} item{overdueItems.length !== 1 ? "s" : ""}
              </p>
              <div className="space-y-2">
                {overdueItems.map((item) => (
                  <MilestoneRow key={item.id} item={item} today={today} onToggle={toggleTimelineItem} />
                ))}
              </div>
            </div>
          )}

          {upcomingItems.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
                Upcoming
              </p>
              <div className="space-y-2">
                {upcomingItems.map((item) => (
                  <MilestoneRow key={item.id} item={item} today={today} onToggle={toggleTimelineItem} />
                ))}
              </div>
            </div>
          )}

          {doneItems.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
                Done — {doneItems.length}
              </p>
              <div className="space-y-2">
                {doneItems.map((item) => (
                  <MilestoneRow key={item.id} item={item} today={today} onToggle={toggleTimelineItem} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tasks tab */}
      {subTab === "tasks" && (
        <div className="space-y-4">
          {/* Add task */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Add a task..."
              className="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <button
              onClick={handleAdd}
              className="px-4 py-2 bg-[var(--accent)] text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
            >
              Add
            </button>
          </div>

          {/* Pending */}
          <div className="space-y-2">
            {pendingTasks.map((task) => (
              <div
                key={task.id}
                className="bg-white border border-gray-200 rounded-xl px-5 py-3 flex items-start gap-3"
              >
                <button
                  onClick={() => toggleTask(task.id)}
                  className="mt-0.5 w-4 h-4 rounded border-2 border-gray-300 hover:border-[var(--accent)] shrink-0 transition-colors"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{task.title}</p>
                  {task.flag && (
                    <p className="text-xs text-[var(--accent)] mt-0.5">{task.flag}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant={priorityVariant(task.priority)}>{task.priority}</Badge>
                    <Badge variant="gray">{task.category}</Badge>
                    {task.dueDate && (
                      <span className="text-xs text-gray-400">
                        Due{" "}
                        {new Date(task.dueDate).toLocaleDateString("en-US", {
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                </div>
                {task.id.startsWith("custom-") && (
                  <button
                    onClick={() => removeTask(task.id)}
                    className="text-gray-300 hover:text-red-400 text-xs transition-colors shrink-0"
                  >
                    remove
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Done */}
          {doneTasks.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Done</p>
              <div className="space-y-2">
                {doneTasks.map((task) => (
                  <div
                    key={task.id}
                    className="bg-gray-50 border border-gray-100 rounded-xl px-5 py-3 flex items-center gap-3"
                  >
                    <button
                      onClick={() => toggleTask(task.id)}
                      className="w-4 h-4 rounded bg-[var(--accent)] border-2 border-[var(--accent)] shrink-0"
                    />
                    <p className="text-sm text-gray-400 line-through">{task.title}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
