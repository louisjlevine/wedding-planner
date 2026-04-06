"use client";

import { useState } from "react";
import { usePlanStore } from "@/lib/plan-store";
import { usePlan } from "@/hooks/usePlan";
import { Badge } from "@/components/ui/Badge";
import type { Task } from "@/lib/types";

function priorityVariant(p: Task["priority"]) {
  return p === "high" ? "pink" : p === "medium" ? "yellow" : "gray";
}

export function Tasks() {
  const { tasks, answers, defaultTasks } = usePlan();
  const { toggleTask, addTask, removeTask } = usePlanStore();
  const [newTitle, setNewTitle] = useState("");

  if (!answers) return null;

  // Merge defaultTasks (from adapters) with store tasks, avoiding duplicates
  const storeTasks = tasks;
  const defaultIds = new Set(storeTasks.map((t) => t.id));
  const merged = [
    ...storeTasks,
    ...defaultTasks.filter((t) => !defaultIds.has(t.id)),
  ].sort((a, b) => {
    const pri = { high: 0, medium: 1, low: 2 };
    return pri[a.priority] - pri[b.priority];
  });

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

  const done = merged.filter((t) => t.done);
  const pending = merged.filter((t) => !t.done);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Tasks</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {done.length} of {merged.length} done
        </p>
      </div>

      {/* Add task */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add a task..."
          className="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#D4537E] focus:ring-1 focus:ring-[#D4537E]"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <button
          onClick={handleAdd}
          className="px-4 py-2 bg-[#D4537E] text-white text-sm font-medium rounded-lg hover:bg-[#bf4a70] transition-colors"
        >
          Add
        </button>
      </div>

      {/* Pending */}
      <div className="space-y-2">
        {pending.map((task) => (
          <div
            key={task.id}
            className="bg-white border border-gray-200 rounded-xl px-5 py-3 flex items-start gap-3"
          >
            <button
              onClick={() => toggleTask(task.id)}
              className="mt-0.5 w-4 h-4 rounded border-2 border-gray-300 hover:border-[#D4537E] shrink-0 transition-colors"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{task.title}</p>
              {task.flag && (
                <p className="text-xs text-[#D4537E] mt-0.5">{task.flag}</p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={priorityVariant(task.priority)}>
                  {task.priority}
                </Badge>
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
      {done.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Done
          </p>
          <div className="space-y-2">
            {done.map((task) => (
              <div
                key={task.id}
                className="bg-gray-50 border border-gray-100 rounded-xl px-5 py-3 flex items-center gap-3"
              >
                <button
                  onClick={() => toggleTask(task.id)}
                  className="w-4 h-4 rounded bg-[#D4537E] border-2 border-[#D4537E] shrink-0"
                />
                <p className="text-sm text-gray-400 line-through">{task.title}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
